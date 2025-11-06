const {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const S3_CLIENT_CONFIG = {};
if (process.env.AWS_STAGE === "local") {
  S3_CLIENT_CONFIG.endpoint = "https://localhost.localstack.cloud:4566";
  S3_CLIENT_CONFIG.forcePathStyle = true; // LocalStack prefers path-style addressing
}

const s3 = new S3Client(S3_CLIENT_CONFIG);

const BUCKET_IMAGES_NAME =
  process.env.BUCKET_IMAGES_NAME || "localstack-thumbnails-app-images";
const BUCKET_RESIZED_NAME =
  process.env.BUCKET_RESIZED_NAME || "localstack-thumbnails-app-resized";

/**
 * Lambda handler for listing images in both S3 buckets.
 */
exports.handler = async function () {
  try {
    // Collect original images
    const resultMap = await collectOriginalImages(BUCKET_IMAGES_NAME);

    if (!resultMap) {
      return {
        statusCode: 404,
        body: [],
      };
    }

    // Collect resized images
    await collectResizedImages(BUCKET_RESIZED_NAME, resultMap);

    // Sort and return results
    const sortedItems = sortImagesByTimestamp(resultMap);

    return {
      statusCode: 200,
      body: JSON.stringify(sortedItems),
    };
  } catch (err) {
    console.error("Error listing images:", err);
    throw err;
  }
};

/**
 * Collects original images from the images bucket
 * @param {string} imagesBucket - The name of the images bucket
 * @returns {Promise<Object>} Map of image data indexed by key
 */
async function collectOriginalImages(imagesBucket) {
  const response = await s3.send(
    new ListObjectsV2Command({ Bucket: imagesBucket })
  );
  const objects = response.Contents || [];

  if (objects.length === 0) {
    console.log(`Bucket ${imagesBucket} is empty`);
    return null;
  }

  const resultMap = {};

  for (const obj of objects) {
    const key = obj.Key;
    if (!key) continue;
    const timestamp = obj.LastModified ? obj.LastModified.toISOString() : null;

    const originalUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: imagesBucket, Key: key }),
      { expiresIn: 3600 }
    );

    resultMap[key] = {
      Name: key,
      Timestamp: timestamp,
      Original: {
        Size: obj.Size,
        URL: originalUrl,
      },
    };
  }

  return resultMap;
}

/**
 * Collects resized images and adds them to the result map
 * @param {string} resizedBucket - The name of the resized images bucket
 * @param {Object} resultMap - The map containing original images data
 * @returns {Promise<void>}
 */
async function collectResizedImages(resizedBucket, resultMap) {
  const response = await s3.send(
    new ListObjectsV2Command({ Bucket: resizedBucket })
  );
  const resizedObjects = response.Contents || [];
  for (const obj of resizedObjects) {
    const key = obj.Key;
    if (!key) continue;

    // Only add resized image if original exists
    if (!resultMap[key]) continue;

    const resizedUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: resizedBucket, Key: key }),
      { expiresIn: 3600 }
    );

    resultMap[key].Resized = {
      Size: obj.Size,
      URL: resizedUrl,
    };
  }
}

/**
 * Sorts images by timestamp in descending order
 * @param {Object} resultMap - Map of image data
 * @returns {Array} Sorted array of images
 */
function sortImagesByTimestamp(resultMap) {
  const items = Object.values(resultMap);

  items.sort((a, b) => {
    const ta = a.Timestamp ? new Date(a.Timestamp).getTime() : 0;
    const tb = b.Timestamp ? new Date(b.Timestamp).getTime() : 0;
    return tb - ta;
  });

  return items;
}
