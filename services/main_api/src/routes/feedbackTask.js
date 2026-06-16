const MAX_SCHEDULE_LIMIT = 30 * 60 * 60 * 24; // Represents 30 days in seconds.



const createHttpTaskWithToken = async function (
 payload, // The task HTTP request body 
 project = process.env.PROJECT_ID, // Your GCP Project id
  queue = process.env.QUEUE_NAME, // Name of your Queue
  location = process.env.GCP_REGION, // The GCP region of your queue
  url = process.env.TRANSCRIPT_APP_URL, // The full url path that the request will be sent to
  email = process.env.SERVICE_ACCOUNT_EMAIL, // Cloud IAM service account
  date = new Date() // Intended date to schedule task
) {
  // Imports the Google Cloud Tasks library.
  const {v2beta3} = require('@google-cloud/tasks');

  // Instantiates a client.
  const client = new v2beta3.CloudTasksClient();

  // Construct the fully qualified queue name.
  const parent = client.queuePath(project, location, queue);

  // Convert message to buffer.
  const convertedPayload = JSON.stringify(payload);
  const body = Buffer.from(convertedPayload).toString('base64');

  const task = {
    httpRequest: {
      httpMethod: 'POST',
      url,
      oidcToken: {
        serviceAccountEmail: email,
        audience: url,
      },
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    },
  };

  const convertedDate = new Date(date);
  const currentDate = new Date();

  // Schedule time can not be in the past.
  if (convertedDate < currentDate) {
    console.error('Scheduled date in the past.');
  } else if (convertedDate > currentDate) {
    const date_diff_in_seconds = (convertedDate - currentDate) / 1000;
    // Restrict schedule time to the 30 day maximum.
    if (date_diff_in_seconds > MAX_SCHEDULE_LIMIT) {
      console.error('Schedule time is over 30 day maximum.');
    }
    // Construct future date in Unix time.
    const date_in_seconds =
      Math.min(date_diff_in_seconds, MAX_SCHEDULE_LIMIT) + Date.now() / 1000;
    // Add schedule time to request in Unix time using Timestamp structure.
    // https://googleapis.dev/nodejs/tasks/latest/google.protobuf.html#.Timestamp
    task.scheduleTime = {
      seconds: date_in_seconds,
    };
  }

  try {
    // Send create task request.
    console.log("parent:" , parent)

    const test_parent = process.env.QUEUE_PATH
    const [response] = await client.createTask({parent : test_parent, task});
    console.log(`Created task ${response.name}`);
    return response.name;
  } catch (error) {
    // Construct error for Stackdriver Error Reporting
    console.error(Error(error.message));
    console.log("GOOGLE_APPLICATION_CREDENTIALS", process.env.GOOGLE_APPLICATION_CREDENTIALS)
    throw error;
  }
};

module.exports = createHttpTaskWithToken;