// Test environment: mock models, a fixed signing secret, no network.
process.env.MODEL_MODE = 'mock';
process.env.WORKER_MODEL = 'mock-worker/drafter';
process.env.REVIEWER_MODEL = 'mock-reviewer/checker';
process.env.APPROVAL_SIGNING_SECRET = 'test-approval-secret-0123456789abcdef0123456789';
process.env.ALLOWED_EMAILS = 'dana@example.com,other@example.com';
