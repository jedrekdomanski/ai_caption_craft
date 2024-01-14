import { Stack, StackProps, Duration, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Table, AttributeType } from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as event_sources from 'aws-cdk-lib/aws-lambda-event-sources';
import apigw = require('aws-cdk-lib/aws-apigateway');
import { AuthorizationType, PassthroughBehavior } from 'aws-cdk-lib/aws-apigateway';
export class AiCaptionCraftStack extends Stack {

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // =====================================================================================
    // Image Bucket
    // =====================================================================================
    const imageBucketName = "cdk-rekn-imagebucket"
    const imageBucket = new s3.Bucket(this, imageBucketName, {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const imageBucketArn = imageBucket.bucketArn;
    imageBucket.addCorsRule({
      allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
      allowedOrigins: ["*"],
      allowedHeaders: ["*"],
      maxAge: 3000
    });

    // =====================================================================================
    // Thumbnail Bucket
    // =====================================================================================
    const resizedBucketName = imageBucketName + "-resized"
    const resizedBucket = new s3.Bucket(this, resizedBucketName, {
      removalPolicy: RemovalPolicy.DESTROY
    });

    const resizedBucketArn = resizedBucket.bucketArn;
    resizedBucket.addCorsRule({
      allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
      allowedOrigins: ["*"],
      allowedHeaders: ["*"],
      maxAge: 3000
    });

    // =====================================================================================
    // Amazon DynamoDB table for storing image labels
    // =====================================================================================
    const table = new Table(this, 'ImageLabels', {
      partitionKey: { name: 'image', type: AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY
    });

    // =====================================================================================
    // Building our AWS Lambda Function; compute for our serverless microservice
    // =====================================================================================
    const layer = new lambda.LayerVersion(this, 'pil', {
      code: lambda.Code.fromAsset('reklayer'),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_7],
      license: 'Apache-2.0',
      description: 'A layer to enable the PIL library in our Rekognition Lambda',
    });

    // =====================================================================================
    // Lambda Layer to process images using Pillow library
    // =====================================================================================
    const rekFn = new lambda.Function(this, 'rekognitionFunction', {
      code: lambda.Code.fromAsset('rekognitionlambda'),
      runtime: lambda.Runtime.PYTHON_3_7,
      handler: 'index.handler',
      timeout: Duration.seconds(30),
      memorySize: 1024,
      layers: [layer],
      environment: {
          "TABLE": table.tableName,
          "BUCKET": imageBucket.bucketName,
          "RESIZEDBUCKET": resizedBucket.bucketName
      },
    });
    rekFn.addEventSource(new event_sources.S3EventSource(imageBucket, {events: [s3.EventType.OBJECT_CREATED]}))

    imageBucket.grantRead(rekFn);
    resizedBucket.grantPut(rekFn);
    table.grantWriteData(rekFn);

    rekFn.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['rekognition:DetectLabels'],
      resources: ['*']
    }));

    // =====================================================================================
    // Service Lambda for Synchronous Front End
    // =====================================================================================
    const serviceFn = new lambda.Function(this, 'serviceFunction', {
      code: lambda.Code.fromAsset('servicelambda'),
      runtime: lambda.Runtime.PYTHON_3_7,
      handler: 'index.handler',
      environment: {
        "TABLE": table.tableName,
        "BUCKET": imageBucket.bucketName,
        "RESIZEDBUCKET": resizedBucket.bucketName
      },
    });

    imageBucket.grantWrite(serviceFn);
    resizedBucket.grantWrite(serviceFn);
    table.grantReadWriteData(serviceFn);

    const api = new apigw.LambdaRestApi(this, 'imageAPI', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: apigw.Cors.ALL_METHODS
      },
      handler: serviceFn,
      proxy: false,
    });
  }
}
