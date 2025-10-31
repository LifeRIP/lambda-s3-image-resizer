const cdk = require("aws-cdk-lib");
const lambda = require("aws-cdk-lib/aws-lambda");
const s3 = require("aws-cdk-lib/aws-s3");
const apigw = require("aws-cdk-lib/aws-apigateway");
const s3n = require("aws-cdk-lib/aws-s3-notifications");

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

    // S3 Bucket for storing resized images
    const S3BucketResized = new s3.Bucket(this, "S3BucketResized", {
      bucketName: "localstack-thumbnails-app-resized",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // Lambda function presign
    const PresignFn = new lambda.Function(this, "PresignFunction", {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/presign"),
      environment: {
        BUCKET_IMAGES_NAME: S3BucketImages.bucketName,
        AWS_STAGE: process.env.AWS_STAGE || "not-set",
      },
    });

    // Lambda function to list images
    const ListFn = new lambda.Function(this, "ListFunction", {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/list"),
      environment: {
        BUCKET_IMAGES_NAME: S3BucketImages.bucketName,
        BUCKET_RESIZED_NAME: S3BucketResized.bucketName,
        AWS_STAGE: process.env.AWS_STAGE || "not-set",
      },
    });

    // Lambda function to resize images (triggered by S3 events)
    const ResizeFn = new lambda.Function(this, "ResizeFunction", {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/resize"),
      environment: {
        BUCKET_RESIZED_NAME: S3BucketResized.bucketName,
        AWS_STAGE: process.env.AWS_STAGE || "not-set",
      },
    });

    // Grant the Lambda function permissions to the S3 bucket
    S3BucketImages.grantReadWrite(PresignFn);

    // Allow the list function to read from both buckets
    S3BucketImages.grantRead(ListFn);
    S3BucketResized.grantRead(ListFn);

    // Configure S3 event to trigger ResizeFn on object creation
    S3BucketImages.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(ResizeFn)
    );
    // TODO: CHECK WHY TRIGGER IS NOT WORKING IN LOCALSTACK

    // API Gateway to trigger functions (single gateway, multiple routes)
    const api = new apigw.RestApi(this, "Api", {
      restApiName: "Lambda S3 Image Resizer Service",
    });

    // /presign -> PresignFn
    const presign = api.root.addResource("presign");
    presign.addMethod("GET", new apigw.LambdaIntegration(PresignFn));

    // Proxy for any subpath under /presign, e.g. /presign/foto.png
    presign.addProxy({
      anyMethod: true,
      defaultIntegration: new apigw.LambdaIntegration(PresignFn),
    });

    // /list -> ListFn
    const list = api.root.addResource("list");
    list.addMethod("GET", new apigw.LambdaIntegration(ListFn));
  }
}

module.exports = { LambdaS3ImageResizerStack };
