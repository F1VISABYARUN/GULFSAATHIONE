// Both extractors see the same raw speech. The worksheet is unavailable to them.
import { runHarness, ALL_ON, ALL_OFF } from '../../server/harness/index.ts';
import { withQuestionContext, type Turn } from '../../server/harness/qa.ts';

export function extractTurn(turn: Turn, enhanced: boolean) {
  const input = enhanced ? withQuestionContext([turn]) : turn.text;
  return runHarness(input, {}, enhanced ? ALL_ON : ALL_OFF);
}
