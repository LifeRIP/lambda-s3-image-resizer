#!/usr/bin/env node
const cdk = require('aws-cdk-lib');
const { LambdaS3ImageResizerStack } = require('../lib/lambda-s3-image-resizer-stack');

const app = new cdk.App();
new LambdaS3ImageResizerStack(app, 'LambdaS3ImageResizerStack');
