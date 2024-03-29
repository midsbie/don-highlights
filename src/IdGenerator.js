// @flow

export default class IdGenerator {
  generate(): string {
    // From: http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
    return (
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    );
  }
}
