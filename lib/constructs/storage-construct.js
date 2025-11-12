const cdk = require("aws-cdk-lib");
const s3 = require("aws-cdk-lib/aws-s3");
const { Construct } = require("constructs");

/**
 * Construct for S3 storage buckets
 */
class StorageConstruct extends Construct {
  constructor(scope, id) {
    super(scope, id);

    // S3 Bucket for storing images
    this.imagesBucket = new s3.Bucket(this, "ImagesBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.POST,
            s3.HttpMethods.PUT,
          ],
          allowedOrigins: [
            "http://localhost:5173",
            "http://localstack-thumbnails-app-frontend.s3-website.localhost.localstack.cloud:4566",
            "http://localstack-thumbnails-app-frontend.s3-website-us-east-1.amazonaws.com",
          ],
          allowedHeaders: [
            "Content-Type",
            "X-Amz-Date",
            "Authorization",
            "X-Api-Key",
            "X-Amz-Security-Token",
            "X-Amz-User-Agent",
          ],
          maxAge: 3000,
        },
      ],
    });

    // S3 Bucket for storing resized images
    this.resizedBucket = new s3.Bucket(this, "ResizedBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET],
          allowedOrigins: [
            "http://localhost:5173",
            "http://localstack-thumbnails-app-frontend.s3-website.localhost.localstack.cloud:4566",
            "http://localstack-thumbnails-app-frontend.s3-website-us-east-1.amazonaws.com",
          ],
          allowedHeaders: [
            "Content-Type",
            "X-Amz-Date",
            "Authorization",
            "X-Api-Key",
            "X-Amz-Security-Token",
            "X-Amz-User-Agent",
          ],
          maxAge: 3000,
        },
      ],
    });
  }
}

module.exports = { StorageConstruct };
