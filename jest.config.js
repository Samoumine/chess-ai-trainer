module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  moduleFileExtensions: ["ts", "tsx", "js"],
  transform: { "^.+\\.(ts|tsx)$": "ts-jest" }
};
