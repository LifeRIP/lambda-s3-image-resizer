const {
  S3Client,
  HeadObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  NotFound,
} = require("@aws-sdk/client-s3");
const { createPresignedPost } = require("@aws-sdk/s3-presigned-post");

const S3_CLIENT_CONFIG = {};
if (process.env.AWS_STAGE === "local") {
  S3_CLIENT_CONFIG.endpoint = "https://localhost.localstack.cloud:4566";
  S3_CLIENT_CONFIG.forcePathStyle = true; // LocalStack prefers path-style addressing
}

// Let the SDK pick up region from environment (Lambda provides it). Pass empty config.
const s3 = new S3Client(S3_CLIENT_CONFIG);

const BUCKET = process.env.BUCKET_NAME || "localstack-thumbnails-app-images";

/**
 * Lambda handler for generating a presigned GET URL for an existing S3 object.
 * Accepts the object key from path parameter.
 */

exports.handler = async function (event) {
  const key = event.path.replace(/^\//, "");
  console.log("Received event:", JSON.stringify(event, null, 2));
  if (!key) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Missing key parameter (use path param or query string)",
      }),
    };
  }

  // Verificar si el bucket existe
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
  }

  // Verificar si el objeto ya existe
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return {
      statusCode: 409,
      body: JSON.stringify({ message: `${BUCKET}/${key} already exists` }),
    };
  } catch (err) {
    if (!(err instanceof NotFound)) {
      throw err;
    }
  }

  // Generar URL prefirmada para subir
  const presignedPost = await createPresignedPost(s3, {
    Bucket: BUCKET,
    Key: key,
    Expires: 300, // 5 minutos
  });

  return {
    statusCode: 200,
    body: JSON.stringify(presignedPost),
  };
};
