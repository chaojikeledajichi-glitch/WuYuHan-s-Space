-- Move the complete IPR project ahead of Hi Translate, preserving project data and IDs.
WITH hi AS (
  SELECT CAST(project.key AS INTEGER) AS position
  FROM portfolio, json_each(portfolio.data, '$.projects') AS project
  WHERE portfolio.id = 'main'
    AND json_extract(project.value, '$.categoryId') = 'category-1'
    AND instr(lower(replace(json_extract(project.value, '$.title'), ' ', '')),
              'hitranslate项目重构升级') > 0
), ipr AS (
  SELECT CAST(project.key AS INTEGER) AS position
  FROM portfolio, json_each(portfolio.data, '$.projects') AS project
  WHERE portfolio.id = 'main'
    AND json_extract(project.value, '$.categoryId') = 'category-1'
    AND (json_extract(project.value, '$.title') = '美团IPR官网设计'
      OR json_extract(project.value, '$.cover') = '/media/photo/c2586f80-a77e-4d5c-85d0-c1e6d22ada3c.webp')
)
UPDATE portfolio
SET data = json_set(data,
  '$.projects[' || (SELECT position FROM hi) || ']',
  json_extract(data, '$.projects[' || (SELECT position FROM ipr) || ']'),
  '$.projects[' || (SELECT position FROM ipr) || ']',
  json_extract(data, '$.projects[' || (SELECT position FROM hi) || ']')),
  revision = revision + 1,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'main'
  AND (SELECT COUNT(*) FROM hi) = 1
  AND (SELECT COUNT(*) FROM ipr) = 1
  AND (SELECT position FROM hi) < (SELECT position FROM ipr);
