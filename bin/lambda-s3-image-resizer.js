#!/usr/bin/env node
require("dotenv").config();

const cdk = require("aws-cdk-lib");
const {
  LambdaS3ImageResizerStack,
} = require("../lib/lambda-s3-image-resizer-stack");
const { FrontendStack } = require("../lib/frontend-stack");

const app = new cdk.App();
new LambdaS3ImageResizerStack(app, "LambdaS3ImageResizerStack");
new FrontendStack(app, "FrontendStack");
