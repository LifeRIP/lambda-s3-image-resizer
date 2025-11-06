const lambda = require("aws-cdk-lib/aws-lambda");
const s3n = require("aws-cdk-lib/aws-s3-notifications");
const s3 = require("aws-cdk-lib/aws-s3");
const { Construct } = require("constructs");

/**
 * Construct for Lambda functions
 */
class LambdaFunctionsConstruct extends Construct {
  constructor(scope, id, props) {
    super(scope, id);

    const { imagesBucket, resizedBucket, errorTopic, awsStage } = props;

    // Lambda function presign
    this.presignFunction = new lambda.Function(this, "PresignFunction", {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/presign"),
      environment: {
        BUCKET_IMAGES_NAME: imagesBucket.bucketName,
        AWS_STAGE: awsStage || "local",
      },
    });

    // Lambda function to list images
    this.listFunction = new lambda.Function(this, "ListFunction", {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/list"),
      environment: {
        BUCKET_IMAGES_NAME: imagesBucket.bucketName,
        BUCKET_RESIZED_NAME: resizedBucket.bucketName,
        AWS_STAGE: awsStage || "local",
      },
    });

    // Lambda Layer with sharp dependency
    const sharpLayer = new lambda.LayerVersion(this, "SharpLayer", {
      code: lambda.Code.fromAsset("lambda/layers/sharp"),
      compatibleRuntimes: [lambda.Runtime.NODEJS_22_X],
      description: "Sharp image processing library",
    });

    // Lambda function to resize images (triggered by S3 events)
    this.resizeFunction = new lambda.Function(this, "ResizeFunction", {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda/resize"),
      layers: [sharpLayer],
      environment: {
        BUCKET_RESIZED_NAME: resizedBucket.bucketName,
        AWS_STAGE: awsStage || "local",
      },
      deadLetterTopic: errorTopic,
    });

    // Grant permissions
    this._grantPermissions(imagesBucket, resizedBucket, errorTopic);

    // Configure S3 event to trigger ResizeFn on object creation
    imagesBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(this.resizeFunction)
    );
  }

  _grantPermissions(imagesBucket, resizedBucket, errorTopic) {
    // Grant the Resize function permission to publish to the SNS topic
    errorTopic.grantPublish(this.resizeFunction);

    // Grant the Presign function permissions to the images bucket
    imagesBucket.grantReadWrite(this.presignFunction);

    // Allow the list function to read from both buckets
    imagesBucket.grantRead(this.listFunction);
    resizedBucket.grantRead(this.listFunction);

    // Grant the Resize function permissions to the S3 buckets
    imagesBucket.grantRead(this.resizeFunction);
    resizedBucket.grantWrite(this.resizeFunction);
  }
}

module.exports = { LambdaFunctionsConstruct };
