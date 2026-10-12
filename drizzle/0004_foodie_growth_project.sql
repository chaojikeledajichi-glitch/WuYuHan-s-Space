-- Append the requested growth project without altering existing projects.
UPDATE portfolio
SET data = json_insert(data, '$.projects[#]',
  json_set(json('{"title":"2024 吃货年度报告","categoryId":"category-3","category":"增长侧支持","year":"2024","className":"thumb-red","art":"","intro":"","body":"","tags":[],"cover":"/media/photo/bbf0dfe1-5470-415b-9489-facadfbf5ce0.webp","pdf":null,"detailImages":[]}'), '$.id',
    'project-' || json_array_length(data, '$.projects'))),
  revision = revision + 1,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'main'
  AND json_type(data, '$.projects') = 'array'
  AND json_array_length(data, '$.projects') < 12
  AND NOT EXISTS (SELECT 1 FROM json_each(portfolio.data, '$.projects') AS existing
    WHERE json_extract(existing.value, '$.categoryId') = 'category-3'
      AND (json_extract(existing.value, '$.cover') = '/media/photo/bbf0dfe1-5470-415b-9489-facadfbf5ce0.webp'
        OR json_extract(existing.value, '$.title') = '2024 吃货年度报告'));
