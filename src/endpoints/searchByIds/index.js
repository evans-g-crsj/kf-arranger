import { get, flatten } from 'lodash';
import { getProject } from '@kfarranger/server';

import byIds from './byIds';
import byBiospecimenId from './byBiospecimenId';

const runPagedQuery = async (project, query, sqon, resultsPath) => {
  let complete = false;
  let offset = 0;
  const size = 1000;
  let results = [];

  while (!complete) {
    const queryResults = await project.runQuery({
      query,
      variables: { sqon, size, offset },
    });
    
    const edges = get(queryResults, resultsPath, []);
    offset += size;
    if (edges.length < size) {
      complete = true;
    }

    results = results.concat(edges);
  }

  return results;
};

const searchSources = (sources) => async (projectId, ids) => {
  const project = getProject(projectId);
  if (!project) {
    throw new Error(`ProjectID '${projectId}' cannot be established.`);
  }

  const promises = sources.map(src => {
    const sqon = src.getSqon(ids);
    return runPagedQuery(project, src.query, sqon, src.resultsPath)
      .then(results => src.transform(results, ids));
  });

  return await Promise.all(promises).then(flatten);
};

const searchAllSources = searchSources([byIds, byBiospecimenId]);

// TODO: multiple queries: one for each entity searched
// x Participants ID
// x Participant External ID
// x Biospecimen ID
// - Sample External ID (there is only one donor per sample and the IDs are consistent and easy to find)
// - Family ID

export default () => async (req, res) => {
  const ids = req.body.ids;
  const projectId = req.body.project;

  try {
    const participants = await searchAllSources(projectId, ids);
    res.json({ participants });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err });
  }
};
