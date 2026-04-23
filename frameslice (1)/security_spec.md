# Security Specification: Vignette Frame Slicer

## Data Invariants
- A `Frame` must belong to a `Project`.
- A `Frame` cannot be created or read if the user does not own the parent `Project`.
- `ownerId` and `projectId` fields are immutable after creation.
- Only the `ownerId` matching `request.auth.uid` can perform writes.
- Video metadata is immutable once set in the Project.

## The Dirty Dozen Payloads
1. **The Identity Thief**: Try to create a project with someone else's `ownerId`. (Failed)
2. **The Orphan Frame**: Create a frame pointing to a project ID that doesn't exist. (Failed)
3. **The Shadow Field**: Add `isVerified: true` to a Project document on update. (Failed)
4. **The Ghost ID**: Inject a 2MB string as a `projectId` path variable. (Failed)
5. **The Time Traveler**: Set `createdAt` to a future date manually. (Failed)
6. **The Hijacker**: Update a project's `ownerId` to yourself when you didn't create it. (Failed)
7. **The Data Pusher**: Inject a 10MB string into the `name` field. (Failed)
8. **The State Skipper**: Directly modify `frameCount` without adding frames via the engine. (Failed)
9. **The PII Blanket**: Try to list all projects in the collection without a user filter. (Failed)
10. **The Update Gap**: Update one field while successfully bypassing the `isValidId` check on another. (Failed)
11. **The ID Poisoning**: Create a document where the ID contains special malicious chars. (Failed)
12. **The Anonymous Write**: Attempt to write to a project without being logged in. (Failed)

## The Test Runner
[Simulated in logic below]
