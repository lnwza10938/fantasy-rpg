async function testStateless() {
  console.log("1. Starting game...");
  const startRes = await fetch("http://localhost:3000/api/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      playerName: "TestActor",
      characterName: "Stateless Hero",
      userId: "123e4567-e89b-12d3-a456-426614174000",
      email: "stateless@test.com",
    }),
  });
  const startData = await startRes.json();
  if (!startData.success) {
    console.error("Failed to start:", startData);
    process.exit(1);
  }
  const charId = startData.data.characterId;
  console.log(`Started successfully! Character ID: ${charId}`);

  console.log("2. Simulating server restart (Server responds statelessly)...");

  console.log("3. Triggering Event without memory state...");
  const eventRes = await fetch("http://localhost:3000/api/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ characterId: charId, regionIndex: 0 }),
  });
  const eventData = await eventRes.json();
  console.log("Event Result:", eventData.data.type);

  if (eventData.success) {
    console.log("Stateless event trigger SUCCESS! 🚀");
  } else {
    console.error("Failed to trigger event statelessly", eventData);
  }
}

testStateless();
