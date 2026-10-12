-- Replace only the third project in the business-support category.
-- All project details and other user content remain intact.
UPDATE portfolio
SET data = json_set(data,
  '$.projects[' || (
    SELECT project.key FROM json_each(portfolio.data, '$.projects') AS project
    WHERE json_extract(project.value, '$.categoryId') = 'category-1'
    ORDER BY CAST(project.key AS INTEGER) LIMIT 1 OFFSET 2
  ) || '].cover', '/media/photo/c2586f80-a77e-4d5c-85d0-c1e6d22ada3c.webp'),
  revision = revision + 1,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'main'
  AND (SELECT COUNT(*) FROM json_each(portfolio.data, '$.projects') AS project
       WHERE json_extract(project.value, '$.categoryId') = 'category-1') >= 3;
