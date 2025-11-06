const cdk = require("aws-cdk-lib");
const { StorageConstruct } = require("./constructs/storage-construct");
const {
  NotificationConstruct,
} = require("./constructs/notification-construct");
const {
  LambdaFunctionsConstruct,
} = require("./constructs/lambda-functions-construct");
const { ApiGatewayConstruct } = require("./constructs/api-gateway-construct");

class LambdaS3ImageResizerStack extends cdk.Stack {
  /**
   * @param {cdk.App} scope
   * @param {string} id
   * @param {cdk.StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    const awsStage = process.env.AWS_STAGE || "local";
    const resizeErrorEmail = process.env.RESIZE_ERROR_EMAIL;

    // Create storage buckets
    const storage = new StorageConstruct(this, "Storage");

    // Create notification topic
    const notification = new NotificationConstruct(this, "Notification", {
      email: resizeErrorEmail,
    });

    // Create Lambda functions with all necessary permissions
    const lambdaFunctions = new LambdaFunctionsConstruct(
      this,
      "LambdaFunctions",
      {
        imagesBucket: storage.imagesBucket,
        resizedBucket: storage.resizedBucket,
        errorTopic: notification.errorTopic,
        awsStage,
      }
    );

    // Create API Gateway
    new ApiGatewayConstruct(this, "ApiGateway", {
      presignFunction: lambdaFunctions.presignFunction,
      listFunction: lambdaFunctions.listFunction,
    });
  }
}

module.exports = { LambdaS3ImageResizerStack };
