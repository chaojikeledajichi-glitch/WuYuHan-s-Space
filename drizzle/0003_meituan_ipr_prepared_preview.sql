-- Attach the requested IPR details to the business project whose cover was just supplied.
-- Preserve its cover, name, PDF reference, and all other portfolio fields.
UPDATE portfolio
SET data = json_set(data,
  '$.projects[' || (SELECT project.key FROM json_each(portfolio.data, '$.projects') AS project
    WHERE json_extract(project.value, '$.categoryId') = 'category-1'
      AND json_extract(project.value, '$.cover') = '/media/photo/c2586f80-a77e-4d5c-85d0-c1e6d22ada3c.webp') || '].detailImages',
  json('[{"url":"/media/photo/095fb954-4938-49ca-b0b8-22d2bbbf918f.webp","width":1600,"height":1350},{"url":"/media/photo/afcb5e22-18a1-44ff-aa02-9ab4edcec33f.webp","width":1600,"height":1800},{"url":"/media/photo/4188b279-fb10-4a39-aa46-56538415c20d.webp","width":1600,"height":2400},{"url":"/media/photo/5bc55fbd-7acf-4ed9-b600-85cae9dae7de.webp","width":1600,"height":1200},{"url":"/media/photo/c432866e-bbf9-488d-ba1b-b7b5983a6771.webp","width":1600,"height":2250}]')),
  revision = revision + 1,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'main'
  AND (SELECT COUNT(*) FROM json_each(portfolio.data, '$.projects') AS project
    WHERE json_extract(project.value, '$.categoryId') = 'category-1'
      AND json_extract(project.value, '$.cover') = '/media/photo/c2586f80-a77e-4d5c-85d0-c1e6d22ada3c.webp') = 1;
