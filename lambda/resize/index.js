const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");
const sharp = require("sharp");

const S3_CLIENT_CONFIG = {};
if (process.env.AWS_STAGE === "local") {
  S3_CLIENT_CONFIG.endpoint = "https://localhost.localstack.cloud:4566";
  S3_CLIENT_CONFIG.forcePathStyle = true; // LocalStack prefers path-style addressing
}

const s3 = new S3Client(S3_CLIENT_CONFIG);
const BUCKET =
  process.env.BUCKET_RESIZED_NAME || "localstack-thumbnails-app-resized";
const MAX_DIMENSIONS = { width: 400, height: 400 };

/**
 * Lambda handler for generating a presigned GET URL for an existing S3 object.
 * Accepts the object key from path parameter.
 */

// Helper: convert a Readable stream (GetObject Body) into a Buffer
async function streamToBuffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// Resize an image buffer to fit within MAX_DIMENSIONS and return a buffer
async function resizeImageBuffer(imageBuffer) {
  // Use sharp to resize while preserving aspect ratio and avoid enlarging
  const resized = await sharp(imageBuffer)
    .resize({
      width: MAX_DIMENSIONS.width,
      height: MAX_DIMENSIONS.height,
      fit: "inside",
      withoutEnlargement: true,
    })
    .toBuffer();
  return resized;
}

// Download from S3, resize, return resized buffer and content type
async function downloadAndResize(bucket, key) {
  const getCmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  const getResp = await s3.send(getCmd);
  const contentType = getResp.ContentType || "application/octet-stream";
  const body = getResp.Body;
  const originalBuffer = await streamToBuffer(body);

  const resizedBuffer = await resizeImageBuffer(originalBuffer);

  return { buffer: resizedBuffer, contentType };
}

exports.handler = async function (event) {
  // target bucket to upload resized images
  const targetBucket = BUCKET;

  // Process each record in the event (S3 put events)
  for (const record of event.Records || []) {
    try {
      const sourceBucket = record.s3.bucket.name;
      let key = record.s3.object.key;
      // replace '+' with ' '
      key = key.replace(/\+/g, " ");
      key = decodeURIComponent(key);

      console.log("resizing", sourceBucket, key);

      const { buffer, contentType } = await downloadAndResize(
        sourceBucket,
        key
      );

      const putCmd = new PutObjectCommand({
        Bucket: targetBucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      });
      await s3.send(putCmd);
      console.log(`uploaded resized image to ${targetBucket}/${key}`);
    } catch (err) {
      console.error("error processing record", err);
      // continue processing other records
    }
  }

  return { statusCode: 200, body: "Processing completed" };
};
