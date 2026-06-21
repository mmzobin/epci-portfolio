import { expect, type APIRequestContext } from "@playwright/test";

export async function resetApp(request: APIRequestContext) {
  const response = await request.post("/api/test/reset", {
    headers: { "x-test-token": process.env.TEST_RESET_TOKEN ?? "local-test-token" }
  });
  const body = await response.text();
  expect(response.ok(), `POST /api/test/reset failed with ${response.status()} ${response.statusText()}: ${body}`).toBeTruthy();
}

export async function saveLevelAssessment(
  request: APIRequestContext,
  payload: { score: number; level: number }
) {
  return request.post("/api/level-assessment", {
    data: payload
  });
}

export async function expectJsonError(response: Awaited<ReturnType<APIRequestContext["post"]>>, status: number) {
  expect(response.status()).toBe(status);
  const body = await response.json();
  expect(body).toHaveProperty("error");
  return body as { error: string };
}
