import { pikaraokeScoreReviews } from "./pikaraokeReviews";

export type ScoreBucket = "low" | "mid" | "high";

export interface ScoreData {
  applause: "applause-l.mp3" | "applause-m.mp3" | "applause-h.mp3";
  review: string;
  bucket: ScoreBucket;
}

// Exact port of `pikaraoke/static/score.js` with personalized name support
export function getScoreData(
  scoreValue: number,
  singerName?: string
): ScoreData {
  const name = singerName || "Você";

  let bucket: ScoreBucket;
  let applause: ScoreData["applause"];
  let reviewTemplate: string;

  if (scoreValue < 30) {
    bucket = "low";
    applause = "applause-l.mp3";
    reviewTemplate =
      pikaraokeScoreReviews.low[
        Math.floor(Math.random() * pikaraokeScoreReviews.low.length)
      ];
  } else if (scoreValue < 60) {
    bucket = "mid";
    applause = "applause-m.mp3";
    reviewTemplate =
      pikaraokeScoreReviews.mid[
        Math.floor(Math.random() * pikaraokeScoreReviews.mid.length)
      ];
  } else {
    bucket = "high";
    applause = "applause-h.mp3";
    reviewTemplate =
      pikaraokeScoreReviews.high[
        Math.floor(Math.random() * pikaraokeScoreReviews.high.length)
      ];
  }

  return {
    bucket,
    applause,
    review: reviewTemplate.replace(/\{name\}/g, name),
  };
}

// Exact port of: bias=2; pow(rand, 1/bias)*99
export function getScoreValue(): number {
  const random = Math.random();
  const bias = 2;
  const scoreValue = Math.pow(random, 1 / bias) * 99;
  return Math.floor(scoreValue);
}

export async function rotateScore(
  setScoreText: (text: string) => void,
  durationMs: number
): Promise<void> {
  const interval = 100;
  const startTime = performance.now();

  while (true) {
    const elapsed = performance.now() - startTime;
    if (elapsed >= durationMs) break;

    const randomScore = String(Math.floor(Math.random() * 99) + 1).padStart(
      2,
      "0"
    );
    setScoreText(randomScore);

    const nextUpdate = interval - (performance.now() - (startTime + elapsed));
    await new Promise(resolve => setTimeout(resolve, Math.max(0, nextUpdate)));
  }
}
