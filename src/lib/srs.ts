// SM-2 simplificado (Anki-style). Notas: 0..5
// 0-2 = errou; 3 = passou difícil; 4 = bom; 5 = fácil
export type SrsCard = {
  ease: number;
  interval_days: number;
  repetitions: number;
};

export type SrsResult = {
  ease: number;
  interval_days: number;
  repetitions: number;
  due_at: string; // ISO
};

export function nextReview(card: SrsCard, grade: number): SrsResult {
  let { ease, interval_days, repetitions } = card;
  if (grade < 3) {
    repetitions = 0;
    interval_days = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) interval_days = 1;
    else if (repetitions === 2) interval_days = 3;
    else interval_days = Math.round(interval_days * ease);
    ease = Math.max(1.3, ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));
  }
  const due = new Date();
  due.setDate(due.getDate() + interval_days);
  // Se grade < 3, revisar daqui ~10 minutos (mesmo dia)
  if (grade < 3) {
    due.setTime(Date.now() + 10 * 60 * 1000);
  }
  return { ease, interval_days, repetitions, due_at: due.toISOString() };
}

export const GRADE_LABELS: { value: number; label: string; tone: string; hint: string }[] = [
  { value: 0, label: "Errei feio", tone: "destructive", hint: "Não fazia ideia" },
  { value: 3, label: "Difícil",    tone: "gold",        hint: "Acertei sofrendo / quase errei" },
  { value: 4, label: "Bom",        tone: "primary",     hint: "Acertei normal" },
  { value: 5, label: "Fácil",      tone: "success",     hint: "Bati o olho e acertei" },
];
