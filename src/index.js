import PerformanceAgent from './agents/PerformanceAgent.js';
import BestPracticesAgent from './agents/DebuggingAgent.js';
import { logger } from './utils/logger.js';



export async function runPerformanceAnalysis(file) {
  try {
    const agent = new PerformanceAgent();
    await agent.analyze(file);
  } catch (error) {
    logger.error(error.message);
  }
}

export async function runDebugAnalysis(file) {
  try {
    const agent = new BestPracticesAgent();
    await agent.analyze(file);
  } catch (error) {
    logger.error(error.message);
  }
}