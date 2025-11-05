const cdk = require("aws-cdk-lib");
const lambda = require("aws-cdk-lib/aws-lambda");
const s3 = require("aws-cdk-lib/aws-s3");
const apigw = require("aws-cdk-lib/aws-apigateway");
const s3n = require("aws-cdk-lib/aws-s3-notifications");
const sns = require("aws-cdk-lib/aws-sns");
const subs = require("aws-cdk-lib/aws-sns-subscriptions");

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
        AWS_STAGE: process.env.AWS_STAGE || "local",
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
        AWS_STAGE: process.env.AWS_STAGE || "local",
      },
    });

    // SNS Topic for resize error notifications
    const ResizeErrorTopic = new sns.Topic(this, "ResizeErrorTopic", {
      displayName: "Image Resize Error Notifications",
      topicName: "resize-error-topic",
    });

    // Subscribe an email to the SNS topic for error notifications
    ResizeErrorTopic.addSubscription(
      new subs.EmailSubscription(
        process.env.RESIZE_ERROR_EMAIL || "my-email@example.com"
      )
    );

    // Lambda Layer with sharp dependency
    const sharpLayer = new lambda.LayerVersion(this, "SharpLayer", {
      code: lambda.Code.fromAsset("lambda/layers/sharp"),
      compatibleRuntimes: [lambda.Runtime.NODEJS_22_X],
      description: "Sharp image processing library",
    });

    // Lambda function to resize images (triggered by S3 events)
    const ResizeFn = new lambda.Function(this, "ResizeFunction", {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/resize"),
      layers: [sharpLayer],
      environment: {
        BUCKET_RESIZED_NAME: S3BucketResized.bucketName,
        AWS_STAGE: process.env.AWS_STAGE || "local",
      },
      deadLetterTopic: ResizeErrorTopic,
    });

    // Grant the Resize function permission to publish to the SNS topic
    ResizeErrorTopic.grantPublish(ResizeFn);

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

    // Grant the Lambda function permissions to the S3 buckets
    S3BucketImages.grantRead(ResizeFn);
    S3BucketResized.grantWrite(ResizeFn);

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
