import { Stack, StackProps, Duration, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Bucket, BlockPublicAccess, HttpMethods } from 'aws-cdk-lib/aws-s3';



export class AiCaptionCraftStack extends Stack {

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // =====================================================================================
    // Image Bucket
    // =====================================================================================
    const imageBucketName = "cdk-rekn-imgagebucket"
    const imageBucket = new Bucket(this, imageBucketName, {
      removalPolicy: RemovalPolicy.DESTROY
    });

    const imageBucketArn = imageBucket.bucketArn;
    imageBucket.addCorsRule({
      allowedMethods: [HttpMethods.GET, HttpMethods.PUT],
      allowedOrigins: ["*"],
      allowedHeaders: ["*"],
      maxAge: 3000
    });

    // =====================================================================================
    // Thumbnail Bucket
    // =====================================================================================
    const resizedBucketName = imageBucketName + "-resized"
    const resizedBucket = new Bucket(this, resizedBucketName, {
      removalPolicy: RemovalPolicy.DESTROY
    });

    const resizedBucketArn = resizedBucket.bucketArn;
    resizedBucket.addCorsRule({
      allowedMethods: [HttpMethods.GET, HttpMethods.PUT],
      allowedOrigins: ["*"],
      allowedHeaders: ["*"],
      maxAge: 3000
    });
  }
}
