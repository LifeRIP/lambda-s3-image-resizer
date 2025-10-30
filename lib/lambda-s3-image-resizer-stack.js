const cdk = require("aws-cdk-lib");
const lambda = require("aws-cdk-lib/aws-lambda");
const s3 = require("aws-cdk-lib/aws-s3");
const apigw = require("aws-cdk-lib/aws-apigateway");

class LambdaS3ImageResizerStack extends cdk.Stack {
  /**
   * @param {cdk.App} scope
   * @param {string} id
   * @param {cdk.StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    // S3 Bucket for storing images
    const S3BucketImages = new s3.Bucket(this, "S3BucketImages", {
      bucketName: "localstack-thumbnails-app-images",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // Lambda function presign
    const PresignFn = new lambda.Function(this, "PresignFunction", {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/presign"),
      environment: {
        BUCKET_NAME: S3BucketImages.bucketName,
      },
    });

    // Grant the Lambda function permissions to the S3 bucket
    S3BucketImages.grantReadWrite(PresignFn);

    // API Gateway to trigger the Lambda function
    const api = new apigw.LambdaRestApi(this, "PresignApi", {
      handler: PresignFn,
    });
  }
}

module.exports = { LambdaS3ImageResizerStack };
