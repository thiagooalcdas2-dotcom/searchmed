import { supabase } from "@/integrations/supabase/client";

// Insere o card se não existir (devido ao UNIQUE user_id+question_id), sem sobrescrever progresso.
export async function enqueueReviewCard(
  userId: string,
  questionId: string,
  source: "wrong_answer" | "manual_mark" | "simulado_wrong" = "wrong_answer",
) {
  await supabase.from("review_cards").upsert(
    { user_id: userId, question_id: questionId, source },
    { onConflict: "user_id,question_id", ignoreDuplicates: true },
  );
}

export async function enqueueManyWrong(userId: string, questionIds: string[], source: "wrong_answer" | "simulado_wrong") {
  if (questionIds.length === 0) return;
  const rows = questionIds.map((qid) => ({ user_id: userId, question_id: qid, source }));
  await supabase.from("review_cards").upsert(rows, { onConflict: "user_id,question_id", ignoreDuplicates: true });
}
