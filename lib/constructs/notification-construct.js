const sns = require("aws-cdk-lib/aws-sns");
const subs = require("aws-cdk-lib/aws-sns-subscriptions");
const { Construct } = require("constructs");

/**
 * Construct for SNS notifications
 */
class NotificationConstruct extends Construct {
  constructor(scope, id, props) {
    super(scope, id);

    const { email } = props;

    // SNS Topic for resize error notifications
    this.errorTopic = new sns.Topic(this, "ResizeErrorTopic", {
      displayName: "Image Resize Error Notifications",
      topicName: "resize-error-topic",
    });

    // Subscribe an email to the SNS topic for error notifications
    this.errorTopic.addSubscription(
      new subs.EmailSubscription(email || "my-email@example.com")
    );
  }
}

module.exports = { NotificationConstruct };
