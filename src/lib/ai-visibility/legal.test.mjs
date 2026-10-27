import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { KEEP_MS } from '../../../netlify/functions/_lib/engine.mjs';

const root = new URL('../../../', import.meta.url);

function read(path) {
  return readFileSync(new URL(path, root), 'utf8');
}

function fill(template, days) {
  return template.replaceAll('{setupDays}', String(days));
}

describe('AI Visibility legal copy', () => {
  const page = JSON.parse(read('src/content/ai-visibility/page.json'));
  const terms = read('src/pages/terms.astro');
  const privacy = read('src/pages/privacy.astro');
  const days = page.setupDays;

  it('uses a national title and tim@revvia.com', () => {
    assert.equal(page.seoTitle.includes('San Diego'), false);
    assert.match(page.seoTitle, /Home-Service Trades/);
    assert.match(page.metaDescription, /anywhere in the US/);
    assert.equal(JSON.stringify(page).includes('check@revvia.com'), false);
    assert.match(page.check.step2Under, /tim@revvia.com/);
    assert.match(page.thanks.freeBody, /tim@revvia.com/);
    assert.match(page.thanks.paidBody, /tim@revvia.com/);
  });

  it('quotes the AI Visibility guarantee, founding offer, and 90-day check retention', () => {
    const faq = (question) => page.faq.find((item) => item.question === question).answer;
    const guarantee = fill(faq('So what do you guarantee?'), days).replace(/^That /, '');
    for (const text of [
      guarantee,
      fill(page.riskItems[0].body, days).replace(/ This covers our work, not what AI assistants say\.$/, ''),
      page.riskItems[3].title,
      'If your setup was waived through the founding offer, there\'s no setup fee to refund.',
      'We don\'t promise calls, leads, revenue, or rankings, because no one can.',
      page.foundingLine,
      'with their approval',
      page.renewalDisclosure,
      "There's no six-month agreement. Service runs through the month you paid for.",
      'AI answers vary from run to run and change as the assistants update.',
    ]) {
      assert.equal(terms.includes(text), true, text);
    }
    assert.equal(terms.includes('Yes, anytime, online'), false);
    assert.equal(terms.includes('The setup fee and the monthly fees are non-refundable'), false);
    assert.match(terms, /end of the current billing period/);
    assert.match(terms, /[Mm]onthly fees are non-refundable/);
    assert.equal(page.thanks.paidBody.includes('1 business day'), false);
    assert.match(page.thanks.paidBody, /right away/);
    assert.match(privacy, /OpenAI/);
    assert.match(privacy, /Perplexity/);
    assert.match(privacy, /Anthropic/);
    assert.match(privacy, /Cloudflare Turnstile/);
    assert.match(privacy, /90 days/);
    assert.match(privacy, /\/unsubscribe/);
    assert.equal(KEEP_MS, 90 * 86400000);
    const intake = read('src/pages/ai-visibility/intake.astro');
    assert.match(intake, /name="aiv-intake"/);
    assert.match(intake, /tim@revvia.com/);
    assert.equal(intake.includes(page.foundingLine), true);
    assert.equal(intake.includes('Our first 10 clients get the $497 setup waived'), false);
  });
});
