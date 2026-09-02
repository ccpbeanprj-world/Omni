const { AiOrchestrator } = require('./orchestrator');
const { createAiRouter } = require('./routes');
const { getAiConfig, getPublicAiStatus } = require('./config');

function createAiModule(deps = {}) {
  const orchestrator = new AiOrchestrator(deps);
  const router = createAiRouter(orchestrator);
  return { orchestrator, router, getAiConfig, getPublicAiStatus };
}

module.exports = { createAiModule, getAiConfig, getPublicAiStatus };
