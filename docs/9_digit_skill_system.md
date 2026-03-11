# 9-Digit Procedural Skill System

## Concept Overview

To support endless build variety, skills are generated procedurally using a 9-digit code. Each digit (0-9) maps to a specific attribute of the skill. When a character is created, they randomly generate this 9-digit code.

The game does NOT hardcode the outcome of all 1 billion possible combinations. Instead, the 9-digit code is passed to an AI API, which interprets the mechanics and generates a balanced, thematic skill name, description, and exact numerical effects based on the digits.

---

## The 9-Digit Structure

| Digit | Category                             | Description                                  |
| ----- | ------------------------------------ | -------------------------------------------- |
| **1** | **Trigger** (ตัวกระตุ้น)             | What causes the skill to activate?           |
| **2** | **SkillRole** (บทบาทสกิล)            | General purpose of the skill.                |
| **3** | **TargetType** (ประเภทเป้าหมาย)      | Who does this skill affect?                  |
| **4** | **EffectType** (ประเภทผล)            | What kind of damage or effect is applied?    |
| **5** | **ScalingSource** (แหล่งสเกล)        | What stat makes this skill stronger?         |
| **6** | **DeliveryType** (รูปแบบการส่งผล)    | How does the skill physically manifest?      |
| **7** | **DurationType** (ระยะเวลา)          | How long does the effect last?               |
| **8** | **SecondaryModifier** (ตัวปรับรอง)   | Additional effects (e.g., life steal, slow). |
| **9** | **SpecialProperty** (คุณสมบัติพิเศษ) | Rare or game-changing modifiers.             |

---

## Detailed Mappings (0-9)

### 1. Trigger (ตัวกระตุ้น)

- 0 = SelfCast (ใช้เอง)
- 1 = OnHit (เมื่อโจมตีโดน)
- 2 = OnDamaged (เมื่อถูกโจมตี)
- 3 = OnKill (เมื่อฆ่าศัตรู)
- 4 = LowHP (HP ต่ำ)
- 5 = LowMana (มานาต่ำ)
- 6 = Timed (ตามเวลา)
- 7 = EnterCombat (เข้าสู่การต่อสู้)
- 8 = BuffEvent (เมื่อเกิดบัฟ/ดีบัฟ)
- 9 = RandomTrigger (สุ่ม)

### 2. SkillRole (บทบาทสกิล)

- 0 = None (ไม่มีผลตรง)
- 1 = Attack (โจมตี)
- 2 = Defense (ป้องกัน)
- 3 = Buff (บัฟ)
- 4 = Debuff (ดีบัฟ)
- 5 = Curse (คำสาป)
- 6 = Heal (ฟื้นฟู)
- 7 = Summon (อัญเชิญ)
- 8 = Utility (ยูทิลิตี้)
- 9 = RandomRole (สุ่ม)

### 3. TargetType (ประเภทเป้าหมาย)

- 0 = Self (ตัวเอง)
- 1 = SingleEnemy (ศัตรูเดี่ยว)
- 2 = MultiEnemy (ศัตรูหลายตัว)
- 3 = AllEnemies (ศัตรูทั้งหมด)
- 4 = Area (พื้นที่)
- 5 = SingleAlly (พันธมิตรเดี่ยว)
- 6 = AllAllies (พันธมิตรทั้งหมด)
- 7 = RandomTarget (สุ่มเป้าหมาย)
- 8 = AllUnitsArea (ทุกหน่วยในพื้นที่)
- 9 = RandomTargetType (สุ่ม)

### 4. EffectType (ประเภทผล)

- 0 = None (ไม่มีความเสียหาย)
- 1 = Physical (กายภาพ)
- 2 = Magical (เวทมนตร์)
- 3 = Soul (วิญญาณ)
- 4 = LifeSteal (ดูด HP)
- 5 = ManaDrain (ดูดมานา)
- 6 = MaxHPDamage (ทำลาย HP สูงสุด)
- 7 = ManaBreak (ทำลายมานา)
- 8 = ArmorBreak (ทำลายเกราะ)
- 9 = RandomEffect (สุ่ม)

### 5. ScalingSource (แหล่งสเกล)

- 0 = NoScaling (ไม่สเกล)
- 1 = AttackPower (พลังโจมตี)
- 2 = DefensePower (พลังป้องกัน)
- 3 = MaxHP (HP สูงสุด)
- 4 = MaxMana (มานาสูงสุด)
- 5 = Speed (ความเร็ว)
- 6 = Level (เลเวล)
- 7 = EnemyCount (จำนวนศัตรู)
- 8 = BuffCount (จำนวนบัฟ/ดีบัฟ)
- 9 = RandomScaling (สุ่ม)

### 6. DeliveryType (รูปแบบการส่งผล)

- 0 = Instant (ทันที)
- 1 = DirectStrike (โจมตีตรง)
- 2 = Explosion (ระเบิด)
- 3 = Wave (คลื่น)
- 4 = Chain (โซ่กระเด้ง)
- 5 = Aura (ออร่า)
- 6 = Ring (วงแหวน)
- 7 = Beam (ลำแสง)
- 8 = SpawnObject (สร้างวัตถุ/พื้นที่)
- 9 = RandomDelivery (สุ่ม)

### 7. DurationType (ระยะเวลา)

- 0 = Instant (ทันที)
- 1 = Short (ระยะสั้น)
- 2 = Medium (ระยะกลาง)
- 3 = Long (ระยะยาว)
- 4 = Continuous (ต่อเนื่อง)
- 5 = Periodic (เป็นช่วงเวลา)
- 6 = Stackable (สะสม)
- 7 = Delayed (ระเบิดภายหลัง)
- 8 = Conditional (จนกว่าจะหมดเงื่อนไข)
- 9 = RandomDuration (สุ่ม)

### 8. SecondaryModifier (ตัวปรับรอง)

- 0 = None (ไม่มี)
- 1 = LifeSteal (ดูดเลือด)
- 2 = ArmorUp (เพิ่มเกราะ)
- 3 = AttackUp (เพิ่มพลังโจมตี)
- 4 = Slow (ลดความเร็วศัตรู)
- 5 = StatusEffect (ติดสถานะ)
- 6 = Bounce (กระเด้ง)
- 7 = RangeUp (เพิ่มระยะ/พื้นที่)
- 8 = CooldownReduce (ลดคูลดาวน์)
- 9 = RandomModifier (สุ่ม)

### 9. SpecialProperty (คุณสมบัติพิเศษ)

- 0 = None (ไม่มี)
- 1 = HPTradePower (แลก HP กับพลัง)
- 2 = ManaOverload (ใช้มานาเพิ่มเพื่อเพิ่มผล)
- 3 = RandomOutcome (ผลลัพธ์สุ่ม)
- 4 = Backfire (ย้อนกลับผู้ใช้)
- 5 = PermanentStack (สะสมถาวร)
- 6 = Mutation (กลายพันธุ์เมื่อใช้ซ้ำ)
- 7 = LowHPBoost (แรงขึ้นเมื่อ HP ต่ำ)
- 8 = HiddenUnlock (ปลดล็อกผลลับ)
- 9 = Anomaly (พลังต้องห้าม)

---

## Character Creation Flow

### 1. Separation of World and Character Generation

- **World Generation:** Creates the persistent seed, biomes, and rules.
- **Character Generation:** Handled after World Generation or when rolling a new character for an existing world.

### 2. The 9-Pointed Star UI

- In the Character Creation screen, an interactive **9-pointed star (Nonagram/Enneagram)** is displayed.
- Each point of the star corresponds to one of the 9 digits.
- The player clicks a "Roll Skill" button.
- The star animates, lighting up each point as a random digit (0-9) is rolled.
- Players can re-roll the skill infinitely until they are satisfied.

### 3. AI Interpretation

- Once a 9-digit code is generated (e.g., `213212004`), it is sent to the Game's AI API endpoint.
- The AI returns a structured JSON interpretation of the skill, translating the strict rules into a thematic name, description, and base power values.
- _Example `213212004` (OnDamaged, Attack, AllEnemies, Magical, AttackPower, Explosion, Instant, None, Backfire):_
  - **Name:** "Vengeful Nova"
  - **Description:** "When struck, you release a devastating wave of explosive magic that damages all enemies based on your current Attack Power, but the sheer force damages you as well."

### 4. Locking the Skill

- When the player clicks "Confirm Character", the 9-digit code and the AI's interpreted data are permanently saved to the `player_states` table in the database.
- The character begins the game with this unique Signature Skill. It cannot be changed.
