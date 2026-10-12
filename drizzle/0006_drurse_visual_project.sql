-- Append the requested visual project without altering existing projects.
UPDATE portfolio
SET data = json_insert(data, '$.projects[#]',
  json_set(json('{"title":"糖护士视觉升级","categoryId":"category-2","category":"视觉侧支持","year":"2025","className":"thumb-blue","art":"","intro":"","body":"","tags":[],"cover":"/media/photo/55cf1288-7826-4b59-b2b4-3cd8416d448e.webp","pdf":null,"detailImages":[]}'), '$.id',
    'project-' || json_array_length(data, '$.projects'))),
  revision = revision + 1,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'main'
  AND json_type(data, '$.projects') = 'array'
  AND json_array_length(data, '$.projects') < 12
  AND NOT EXISTS (SELECT 1 FROM json_each(portfolio.data, '$.projects') AS existing
    WHERE json_extract(existing.value, '$.categoryId') = 'category-2'
      AND (json_extract(existing.value, '$.cover') = '/media/photo/55cf1288-7826-4b59-b2b4-3cd8416d448e.webp'
        OR json_extract(existing.value, '$.title') = '糖护士视觉升级'));
