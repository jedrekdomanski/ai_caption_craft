#!/usr/bin/env node
import 'source-map-support/register';
import { App } from 'aws-cdk-lib';

import { AiCaptionCraftStack } from '../lib/ai-caption-craft-stack';

const app = new App();
new AiCaptionCraftStack(app, 'AiCaptionCraftStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  }
});
