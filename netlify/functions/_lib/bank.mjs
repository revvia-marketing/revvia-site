import plumbing from '../../../src/content/check-questions/plumbing.json' with { type: 'json' };
import hvac from '../../../src/content/check-questions/hvac.json' with { type: 'json' };
import electrical from '../../../src/content/check-questions/electrical.json' with { type: 'json' };
import restoration from '../../../src/content/check-questions/restoration.json' with { type: 'json' };
import roofing from '../../../src/content/check-questions/roofing.json' with { type: 'json' };
import other from '../../../src/content/check-questions/other.json' with { type: 'json' };

const BANK = [plumbing, hvac, electrical, restoration, roofing, other];

export function loadQuestionBank() {
  return BANK.slice().sort((a, b) => a.order - b.order);
}
