const apigw = require("aws-cdk-lib/aws-apigateway");
const { Construct } = require("constructs");

/**
 * Construct for API Gateway
 */
class ApiGatewayConstruct extends Construct {
  constructor(scope, id, props) {
    super(scope, id);

    const { presignFunction, listFunction } = props;

    // API Gateway to trigger functions (single gateway, multiple routes)
    this.api = new apigw.RestApi(this, "Api", {
      restApiName: "Lambda S3 Image Resizer Service",
    });

    // /presign -> PresignFn
    const presign = this.api.root.addResource("presign");
    presign.addMethod("GET", new apigw.LambdaIntegration(presignFunction));

    // Proxy for any subpath under /presign, e.g. /presign/foto.png
    presign.addProxy({
      anyMethod: true,
      defaultIntegration: new apigw.LambdaIntegration(presignFunction),
    });

    // /list -> ListFn
    const list = this.api.root.addResource("list");
    list.addMethod("GET", new apigw.LambdaIntegration(listFunction));
  }
}

module.exports = { ApiGatewayConstruct };
