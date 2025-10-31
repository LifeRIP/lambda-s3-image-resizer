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

exports.handler = async function (event) {
  const imagesBucket = BUCKET_IMAGES_NAME;
  try {
    // List original images
    const listed = await s3.send(
      new ListObjectsV2Command({ Bucket: imagesBucket })
    );

    if (!listed.Contents || listed.Contents.length === 0) {
      console.log(`Bucket ${imagesBucket} is empty`);
      return {
        statusCode: 404,
        body: [],
      };
    }

    const resultMap = {};

    // collect the original images
    for (const obj of listed.Contents) {
      const key = obj.Key;
      const timestamp = obj.LastModified
        ? obj.LastModified.toISOString()
        : null;

      // generate presigned GET URL (expires in 3600 seconds)
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

    // collect the associated resized images
    const resizedBucket = BUCKET_RESIZED_NAME;
    const resizedListed = await s3.send(
      new ListObjectsV2Command({ Bucket: resizedBucket })
    );

    // // If there are no resized objects, return an empty array immediately
    // if (
    //   !resizedListed ||
    //   !resizedListed.Contents ||
    //   resizedListed.Contents.length === 0
    // ) {
    //   console.log(`Bucket ${resizedBucket} has no resized objects`);
    //   return {
    //     statusCode: 200,
    //     body: JSON.stringify([]),
    //   };
    // }

    for (const obj of resizedListed.Contents || []) {
      const key = obj.Key;
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

    // return sorted array by Timestamp desc
    const items = Object.values(resultMap);
    items.sort((a, b) => {
      const ta = a.Timestamp ? new Date(a.Timestamp).getTime() : 0;
      const tb = b.Timestamp ? new Date(b.Timestamp).getTime() : 0;
      return tb - ta;
    });

    return {
      statusCode: 200,
      body: JSON.stringify(items),
    };
  } catch (err) {
    console.error("Error listing images:", err);
    throw err;
  }
};
