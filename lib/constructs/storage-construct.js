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
      bucketName: "localstack-thumbnails-app-images",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // S3 Bucket for storing resized images
    this.resizedBucket = new s3.Bucket(this, "ResizedBucket", {
      bucketName: "localstack-thumbnails-app-resized",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });
  }
}

module.exports = { StorageConstruct };
