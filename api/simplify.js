export function GET() {
  return Response.json({
    service: "unclutter-ai",
    status: "ready",
  });
}