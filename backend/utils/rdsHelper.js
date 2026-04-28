// rdsHelper.js - Shared Aurora RDS Data API client and resume-retry logic

const RESUME_ERRORS = ['DatabaseResumingException', 'StatementTimeoutException'];
const RESUME_MAX_ATTEMPTS = 10;
const RESUME_DELAY_MS = 3000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let _rdsClient = null;
function rdsClient() {
  if (!_rdsClient) {
    const { RDSDataClient } = require('@aws-sdk/client-rds-data');
    _rdsClient = new RDSDataClient({});
  }
  return _rdsClient;
}

async function executeWithResume(command) {
  for (let attempt = 1; attempt <= RESUME_MAX_ATTEMPTS; attempt++) {
    try {
      return await rdsClient().send(command);
    } catch (err) {
      if (RESUME_ERRORS.includes(err.name) && attempt < RESUME_MAX_ATTEMPTS) {
        console.log(`Aurora resuming — attempt ${attempt}/${RESUME_MAX_ATTEMPTS}, retrying in ${RESUME_DELAY_MS}ms...`);
        await sleep(RESUME_DELAY_MS);
      } else {
        throw err;
      }
    }
  }
}

module.exports = { rdsClient, executeWithResume };
