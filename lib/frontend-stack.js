const cdk = require("aws-cdk-lib");
const s3 = require("aws-cdk-lib/aws-s3");
const s3deploy = require("aws-cdk-lib/aws-s3-deployment");
class FrontendStack extends cdk.Stack {
  /**
   * @param {cdk.App} scope
   * @param {string} id
   * @param {cdk.StackProps=} props
   */
  constructor(scope, id, props) {
    super(scope, id, props);

    // Bucket for hosting frontend assets
    const websiteBucket = new s3.Bucket(this, "WebsiteBucket", {
      bucketName: "localstack-thumbnails-app-frontend",
      websiteIndexDocument: "index.html",
      publicReadAccess: true, // For public static sites
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS_ONLY, // Allow public read access while blocking ACLs
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For easy cleanup during development
    });

    // Deploy frontend assets to S3 bucket
    new s3deploy.BucketDeployment(this, "DeployWebsite", {
      sources: [s3deploy.Source.asset("./frontend/dist")],
      destinationBucket: websiteBucket,
    });

    // Output the website URL
    new cdk.CfnOutput(this, "WebsiteURL", {
      value: websiteBucket.bucketWebsiteUrl,
    });
  }
}

module.exports = { FrontendStack };
