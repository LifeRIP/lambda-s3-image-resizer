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

const s3 = new S3Client(S3_CLIENT_CONFIG);
const BUCKET =
  process.env.BUCKET_IMAGES_NAME || "localstack-thumbnails-app-images";

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localstack-thumbnails-app-frontend.s3-website.localhost.localstack.cloud:4566",
];

/**
 * Get CORS headers with the appropriate origin
 * @param {string} origin - The origin from the request
 * @returns {Object} CORS headers
 */
function getCorsHeaders(origin) {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];

  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "OPTIONS,GET,PUT,POST,DELETE",
  };
}

/**
 * Lambda handler for generating a presigned GET URL for an existing S3 object.
 * Accepts the object key from path parameter.
 */
exports.handler = async function (event) {
  const origin = event?.headers?.origin || event?.headers?.Origin || "";
  const corsHeaders = getCorsHeaders(origin);
  // Remove '/presign/' prefix from the path to get the actual key
  let key = event.path.replace(/^\/presign\//, "");

  if (!key) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Missing key parameter (use path param or query string)",
      }),
      headers: corsHeaders,
    };
  }

  // Verify if the bucket exists
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
  }

  // Verify if the object already exists
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return {
      statusCode: 409,
      body: JSON.stringify({ message: `${BUCKET}/${key} already exists` }),
      headers: corsHeaders,
    };
  } catch (err) {
    if (!(err instanceof NotFound)) {
      throw err;
    }
  }

  // Generate presigned URL for upload
  const presignedPost = await createPresignedPost(s3, {
    Bucket: BUCKET,
    Key: key,
    Expires: 300, // 5 minutes
  });

  return {
    statusCode: 200,
    body: JSON.stringify(presignedPost),
    headers: corsHeaders,
  };
};
