export const context = {
  payload: {
    pull_request: {
      number: 1,
    },
  },
  repo: {
    owner: "vkirilichev",
    repo: "changed-lines-count-labeler",
  },
};

const mockApi = {
  rest: {
    issues: {
      addLabels: jest.fn(),
      removeLabel: jest.fn(),
    },
    pulls: {
      get: jest.fn().mockResolvedValue({}),
      listFiles: {
        endpoint: {
          merge: jest.fn().mockReturnValue({}),
        },
      },
    },
    repos: {
      getContent: jest.fn(),
    },
  },
  paginate: jest.fn(),
};

export const getOctokit = jest.fn().mockImplementation(() => mockApi);
