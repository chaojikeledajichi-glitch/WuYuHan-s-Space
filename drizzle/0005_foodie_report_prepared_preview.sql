-- Attach the supplied foodie-report detail images to the newly added growth project.
-- Preserve its cover and all other portfolio fields.
UPDATE portfolio
SET data = json_set(data,
  '$.projects[' || (SELECT project.key FROM json_each(portfolio.data, '$.projects') AS project
    WHERE json_extract(project.value, '$.categoryId') = 'category-3'
      AND json_extract(project.value, '$.cover') = '/media/photo/bbf0dfe1-5470-415b-9489-facadfbf5ce0.webp') || '].detailImages',
  json('[{"url":"/media/photo/d347b88b-bc0f-442d-984e-3f262ff2fa24.webp","width":1600,"height":900},{"url":"/media/photo/ff953168-2f02-4d4d-85de-2d15afb51f5b.webp","width":1600,"height":2250},{"url":"/media/photo/db45e7ee-6988-4d52-a91c-b8cf8eb4503f.webp","width":1600,"height":1800},{"url":"/media/photo/cc8bbc1d-4365-426c-a126-f41e9eddba4e.webp","width":1600,"height":1800},{"url":"/media/photo/8d206f85-d313-4ed2-a030-2312dda96c87.webp","width":1600,"height":2400},{"url":"/media/photo/9c6edca7-d213-48b0-9ae1-9bb9bcc551a4.webp","width":1600,"height":300},{"url":"/media/photo/59ada854-2278-4cec-b67c-c352efea8b1f.webp","width":1600,"height":1800},{"url":"/media/photo/b74276d1-2f5a-4083-9a60-3472f06f1dde.webp","width":1600,"height":900},{"url":"/media/photo/f963a093-e5d3-4d08-919f-5ca76576a160.webp","width":1600,"height":1800},{"url":"/media/photo/d519fe50-18d9-45b5-8567-4de86f7dd9cf.webp","width":1600,"height":2400},{"url":"/media/photo/1ee79cff-8655-407a-a170-6295582d7b61.webp","width":1600,"height":300}]')),
  revision = revision + 1,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = 'main'
  AND (SELECT COUNT(*) FROM json_each(portfolio.data, '$.projects') AS project
    WHERE json_extract(project.value, '$.categoryId') = 'category-3'
      AND json_extract(project.value, '$.cover') = '/media/photo/bbf0dfe1-5470-415b-9489-facadfbf5ce0.webp') = 1;
