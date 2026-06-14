from sample_manager import SampleManager, REQUIRED_STATUSES_BEFORE_KB_REVIEW
from schemas import SampleStatus

m = SampleManager()
print('1. rules:', len(m.boundary_rules))

s, new = m.import_annotator_message(
    source_file='t.txt', line_number=10, raw_content='test',
    annotator_name='a', video_id='v1', cover_image_url='http://x', conclusion='ok'
)
print('2. import:', s.sample_id, new, s.current_status.value)

s = m.manager_review(sample_id=s.sample_id, manager_name='周姐', manager_notes='note')
print('3. review:', s.current_status.value)

try:
    m.kb_editor_review(sample_id=s.sample_id, editor_name='小郑', final_status=SampleStatus.CONFIRMED_VIOLATION)
    print('4. ERROR should be blocked')
except ValueError as e:
    print('4. BR005/006 blocked OK:', str(e)[:40])

s = m.add_model_output(
    sample_id=s.sample_id, version='v1', violation_score=0.7,
    confidence=0.8, raw_fragment='frag', operator='周姐'
)
print('5. model_output:', s.current_status.value)

s = m.kb_editor_review(
    sample_id=s.sample_id, editor_name='小郑',
    final_status=SampleStatus.CONFIRMED_VIOLATION, kb_notes='ok'
)
print('6. kb_review:', s.current_status.value)

s = m.rollback_to_status(
    sample_id=s.sample_id, target_status=SampleStatus.ANNOTATOR_IMPORTED,
    operator='周姐', reason='test'
)
print('7. rollback:', s.current_status.value)

d = m.get_manager_review_delta(sample_id=s.sample_id)
print('8. delta:', d is not None, 'can_proceed:', d.get('can_proceed_to_kb_review'))

print('ALL OK')
