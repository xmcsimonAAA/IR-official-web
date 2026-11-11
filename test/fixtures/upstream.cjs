// No external network is used by the regression tests.
global.fetch = async () => new Response('{}', { status: 503 });
