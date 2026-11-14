export type Course = {
  id: number; code: string; title: string; description: string | null; units_count: number; duration_weeks: number | null;
  delivery: 'online' | 'face_to_face' | 'hybrid'; price: number; currency: string; cover_url: string | null; status: string;
  category: { name: string } | null; level: { name: string; cefr: string | null } | null;
};
export type Batch = {
  id: number; code: string; name: string; course_id: number; start_date: string | null; end_date: string | null;
  capacity: number; mode: string; status: string; instructor: { full_name: string } | null;
};
export type Enrollment = {
  id: number; status: string; progress: number; created_at: string; course_id: number; batch_id: number | null;
  course: Course | null; batch: Batch | null;
};
