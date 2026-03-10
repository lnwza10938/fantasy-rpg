// src/scripts/seed_data.ts
import { createMonster, createItem, createEquipment, createMap, createNPC, createFaction } from '../db/contentRepositories.js';

const DATA = {
    "monsters": [
        { "name": "Vile Husk", "type": "undead", "biome": "ruins", "rarity": "common", "description": "A hollowed shell of a man, driven by a lingering hunger for the warmth of the living." },
        { "name": "Gloom-Stalker", "type": "beast", "biome": "forest", "rarity": "uncommon", "description": "A six-legged predator that blends into the shadows of the ancient canopy." },
        { "name": "Carrion Crow-Witch", "type": "abomination", "biome": "swamp", "rarity": "rare", "description": "A twisted fusion of avian bone and dark magic, whispering curses from the muck." },
        { "name": "Iron-Bound Wight", "type": "undead", "biome": "mountain", "rarity": "uncommon", "description": "Ancient warriors whose souls are fused to their rusted plates." },
        { "name": "Void-Wraith", "type": "spirit", "biome": "abyss", "rarity": "rare", "description": "A fragment of pure nothingness, draining the light and hope from all it touches." },
        { "name": "Rot-Feaster", "type": "beast", "biome": "swamp", "rarity": "common", "description": "Bloated, eyeless creatures that thrive on the decay of the marsh." },
        { "name": "Sun-Scorched Revenant", "type": "undead", "biome": "desert", "rarity": "uncommon", "description": "The dried remains of pilgrims who perished under the black sun." },
        { "name": "Abyssal Maw", "type": "demon", "biome": "abyss", "rarity": "elite", "description": "A titan of teeth and spite, guarding the gateway to the lower depths." },
        { "name": "Frost-Bitten Mourner", "type": "spirit", "biome": "tundra", "rarity": "common", "description": "Spectral figures perpetually searching for the warmth they lost in the ice." },
        { "name": "Cinder-Knight", "type": "ancient creature", "biome": "volcanic", "rarity": "legendary", "description": "A guardian of the core, encased in cooling magma and eternal sorrow." },
        { "name": "Blight-Walker", "type": "abomination", "biome": "cursed_land", "rarity": "uncommon", "description": "A shambling mass of tumorous growth spreading a lethal miasma." },
        { "name": "Grave-Root Treant", "type": "ancient creature", "biome": "forest", "rarity": "rare", "description": "An elder tree that has fed on the blood of a thousand battles." },
        { "name": "Shadow-Wing Bat", "type": "beast", "biome": "ruins", "rarity": "common", "description": "Drawn to the echoes of forgotten prayers in the cathedral halls." },
        { "name": "Molten Gargoyle", "type": "demon", "biome": "volcanic", "rarity": "uncommon", "description": "Stone animated by the heat of the earth, striking with fiery precision." },
        { "name": "Dune-Sleeper", "type": "beast", "biome": "desert", "rarity": "rare", "description": "Camouflaged by the shifting sands, it waits for the vibration of a heartbeat." },
        { "name": "Wailing Banshee", "type": "spirit", "biome": "cursed_land", "rarity": "common", "description": "Her scream is a death sentence to those who wander too deep into the fog." },
        { "name": "Crypt-Sentinel", "type": "undead", "rarity": "uncommon", "biome": "ruins", "description": "Motionless until the seal of the tomb is broken." },
        { "name": "Gore-Hound", "type": "demon", "biome": "cursed_land", "rarity": "common", "description": "The hunting dogs of the dark lords, leave trails of sulfur and blood." },
        { "name": "Obsidian Golem", "type": "ancient creature", "biome": "mountain", "rarity": "elite", "description": "A monolith of stone carved by giants to hold the high passes." },
        { "name": "Mire-Lurker", "type": "abomination", "biome": "swamp", "rarity": "uncommon", "description": "A predatory mass of tentacles mimicking the appearance of dry land." },
        { "name": "Ancient Wyrm-Husk", "type": "undead", "biome": "tundra", "rarity": "legendary", "description": "The skeletal remains of a dragon, reanimated by necromantic frost." },
        { "name": "Soul-Eater", "type": "spirit", "biome": "abyss", "rarity": "rare", "description": "Transparent forms that feast on the memories of the dying." },
        { "name": "Bramble-Horror", "type": "beast", "biome": "forest", "rarity": "uncommon", "description": "Vines fused with animal flesh, seeking to reclaim the land from men." },
        { "name": "Dust-Devourer", "type": "demon", "biome": "desert", "rarity": "common", "description": "Small, chattering imps that swarm travellers in the blinding heat." },
        { "name": "Basalt-Behemoth", "type": "beast", "biome": "volcanic", "rarity": "elite", "description": "A massive armored beast that thrives in the rivers of fire." },
        { "name": "Ghostly Centurion", "type": "spirit", "biome": "ruins", "rarity": "uncommon", "description": "Still leading his spectral legion in a war that ended centuries ago." },
        { "name": "Plague-Bearer", "type": "demon", "biome": "swamp", "rarity": "rare", "description": "A winged herald of rot, dripping poison from its jagged beak." },
        { "name": "Fell-Wolf", "type": "beast", "biome": "forest", "rarity": "common", "description": "Black-eyed wolves that hunt with a grim, human-like intelligence." },
        { "name": "Tomb-Spider", "type": "beast", "biome": "ruins", "rarity": "uncommon", "description": "Its webs are spun from the hair of the dead and the silk of nightmares." },
        { "name": "Ice-Vein Horror", "type": "abomination", "biome": "tundra", "rarity": "rare", "description": "A jagged creature of frozen blood and splintered bone." },
        { "name": "Sorrow-Bound Widow", "type": "spirit", "biome": "cursed_land", "rarity": "common", "description": "She lures the weary into her embrace, only to leave them cold and empty." },
        { "name": "Mountain-Crusher", "type": "ancient creature", "biome": "mountain", "rarity": "legendary", "description": "A cyclopean entity that can cause avalanches with a single shout." },
        { "name": "Sand-Stalker", "type": "beast", "biome": "desert", "rarity": "uncommon", "description": "Hard-shelled hunters that move beneath the dunes with terrifying speed." },
        { "name": "Corrupted Seraph", "type": "spirit", "biome": "ruins", "rarity": "elite", "description": "A falling angel whose wings are now tethered to the earthly rot." },
        { "name": "Slaughter-Fiend", "type": "demon", "biome": "abyss", "rarity": "rare", "description": "Born from the spilled blood of a thousand innocents." },
        { "name": "Lichen-Ghoul", "type": "undead", "biome": "forest", "rarity": "common", "description": "Zombies overgrown with bioluminescent fungi that signal their approach." },
        { "name": "Bog-Man", "type": "undead", "biome": "swamp", "rarity": "uncommon", "description": "The preserved remains of sacrifice victims, rising from the peat." },
        { "name": "Iron-Eater", "type": "beast", "biome": "mountain", "rarity": "rare", "description": "A heavy, subterranean predator that ignores flesh and hunts for steel." },
        { "name": "Flame-Spite", "type": "demon", "biome": "volcanic", "rarity": "common", "description": "Noxious spirits that manifest in the smoke of the burning craters." },
        { "name": "The Unmaker", "type": "ancient creature", "biome": "abyss", "rarity": "legendary", "description": "A primordial entity that predates the creation of the stars." },
        { "name": "Warped Husk", "type": "abomination", "biome": "cursed_land", "rarity": "uncommon", "description": "What remains when a mage’s spell goes horribly, lethally wrong." },
        { "name": "Vulture-Knight", "type": "undead", "biome": "desert", "rarity": "rare", "description": "Riding skeletal mounts, they scour the sands for the dying." },
        { "name": "Glacial Construct", "type": "ancient creature", "biome": "tundra", "rarity": "elite", "description": "Blocks of ice infused with runes to defend the high passes." },
        { "name": "Night-Shade", "type": "spirit", "biome": "forest", "rarity": "common", "description": "Sentient darkness that strangles the breath out of the sleeping." },
        { "name": "Screaming Mandrake", "type": "abomination", "biome": "swamp", "rarity": "uncommon", "description": "Fungal growths with human faces that shriek when disturbed." },
        { "name": "Ruin-Watcher", "type": "ancient creature", "biome": "ruins", "rarity": "rare", "description": "Floating stone eyes that fire beams of concentrated history." },
        { "name": "Ashen Husk", "type": "undead", "biome": "volcanic", "rarity": "common", "description": "Burnt victims of the eruption, wandering aimlessly in the smoke." },
        { "name": "Sky-Scourge", "type": "beast", "biome": "mountain", "rarity": "uncommon", "description": "Massive leathery wings that cast a shadow of death over the valleys." },
        { "name": "Flesh-Weaver", "type": "demon", "biome": "abyss", "rarity": "elite", "description": "A multi-limbed architect of agony, crafting meat into dark art." },
        { "name": "The Silent King", "type": "undead", "biome": "ruins", "rarity": "legendary", "description": "The first ruler of the ruined city, still sitting on his crumbling throne." }
    ],
    "items": [
        { "name": "Reaper's Sigh", "type": "weapon", "rarity": "rare", "description": "An obsidian scythe that pulses with the rhythm of distant heartbeats.", "effect": "shadow_damage" },
        { "name": "Iron Maiden's Embrace", "type": "armor", "rarity": "uncommon", "description": "Rusted plate mail that offers protection at the cost of constant internal pain.", "effect": "curse_resistance" },
        { "name": "Vial of Black Blood", "type": "consumable", "rarity": "common", "description": "A thick, foul-smelling liquid that accelerates physical healing.", "effect": "heal_hp" },
        { "name": "Crown of the Fallen King", "type": "artifact", "rarity": "legendary", "description": "A heavy gold circlet that whispers the names of its previous owners.", "effect": "summon_spirit" },
        { "name": "Cinder-Laced Shield", "type": "armor", "rarity": "rare", "description": "Crafted from cooled basalt, it burns those who strike it.", "effect": "fire_damage" },
        { "name": "Void Potion", "type": "consumable", "rarity": "uncommon", "description": "Restores the mind but dims the eyesight for a short duration.", "effect": "mana_restore" },
        { "name": "Serpent's Fang", "type": "weapon", "rarity": "common", "description": "A simple dagger coated in a slow-acting paralysis toxin.", "effect": "poison_damage" },
        { "name": "Echoing Bell", "type": "relic", "rarity": "rare", "description": "A small brass bell that can banish minor spirits for a short time.", "effect": "shadow_damage" },
        { "name": "Wraith-Skin Cloak", "type": "armor", "rarity": "uncommon", "description": "Tattered fabric that allows the wearer to move like smoke.", "effect": "curse_resistance" },
        { "name": "Eye of the Abyss", "type": "artifact", "rarity": "legendary", "description": "A petrified eye that grants sight into the spirit realm.", "effect": "shadow_damage" },
        { "name": "Rusted Knight's Blade", "type": "weapon", "rarity": "common", "description": "A reliable sword from a long-forgotten war.", "effect": "poison_damage" },
        { "name": "Guardian's Brew", "type": "consumable", "rarity": "uncommon", "description": "Strengthens the heart against the influence of the void.", "effect": "curse_resistance" },
        { "name": "Pendant of Sorrow", "type": "relic", "rarity": "common", "description": "A locket containing the ashes of a saint.", "effect": "heal_hp" },
        { "name": "Soul-Splitter Axe", "type": "weapon", "rarity": "rare", "description": "A massive bearded axe that leaves shimmering lacerations.", "effect": "shadow_damage" },
        { "name": "Plate of the Sentinel", "type": "armor", "rarity": "elite", "description": "Immovable armor that grows heavier the closer danger is.", "effect": "curse_resistance" },
        { "name": "Phoenix Feather", "type": "consumable", "rarity": "rare", "description": "Used to ignite a fire that cannot be quenched by water.", "effect": "fire_damage" },
        { "name": "Scribe's Inkwell", "type": "relic", "rarity": "uncommon", "description": "Allows for the transcription of forbidden runes.", "effect": "mana_restore" },
        { "name": "Hellfire Bow", "type": "weapon", "rarity": "rare", "description": "Arrows shot from this bow leave trails of black smoke and soot.", "effect": "fire_damage" },
        { "name": "Skull-Cap of Whispers", "type": "armor", "rarity": "uncommon", "description": "Grants insights at the price of the wearer's sanity.", "effect": "mana_restore" },
        { "name": "The Weaver's Needle", "type": "relic", "rarity": "rare", "description": "Can stitch together torn souls or garments.", "effect": "heal_hp" },
        { "name": "Grave-Digger's Spade", "type": "weapon", "rarity": "common", "description": "Worn and chipped, but very effective against bones.", "effect": "shadow_damage" },
        { "name": "Elixir of Iron Skin", "type": "consumable", "rarity": "uncommon", "description": "Petrifies the skin temporarily to prevent bleeds.", "effect": "curse_resistance" },
        { "name": "Ancient Moon-Stone", "type": "relic", "rarity": "rare", "description": "Glows with a soft blue light in the presence of undead.", "effect": "mana_restore" },
        { "name": "Dread-Armor", "type": "armor", "rarity": "legendary", "description": "Formed from the skin of demons, it hungers for the wearer's life.", "effect": "shadow_damage" },
        { "name": "Slayer's Crossbow", "type": "weapon", "rarity": "uncommon", "description": "Designed to pierce the thickest scales of dragons.", "effect": "poison_damage" },
        { "name": "Mandrake Extract", "type": "consumable", "rarity": "common", "description": "A paralyzing oil used to coat trap wires.", "effect": "poison_damage" },
        { "name": "Holy Reliquary", "type": "relic", "rarity": "rare", "description": "Contains a finger bone that emits a protective aura.", "effect": "curse_resistance" },
        { "name": "Ebony Spear", "type": "weapon", "rarity": "uncommon", "description": "Perfectly balanced and dark as the night itself.", "effect": "shadow_damage" },
        { "name": "Ranger's Hood", "type": "armor", "rarity": "common", "description": "Common leather hood that masks the face.", "effect": "curse_resistance" },
        { "name": "Flask of Holy Water", "type": "consumable", "rarity": "uncommon", "description": "Sizzles with light when thrown at demons.", "effect": "shadow_damage" },
        { "name": "Runic Tome", "type": "artifact", "rarity": "elite", "description": "A book bound in human skin that teaches world-altering spells.", "effect": "mana_restore" },
        { "name": "Shattered Mirror", "type": "relic", "rarity": "rare", "description": "Traps the reflection of the last person who died near it.", "effect": "summon_spirit" },
        { "name": "Bone-Hilt Dagger", "type": "weapon", "rarity": "common", "description": "The hilt is made from a child's femur.", "effect": "poison_damage" },
        { "name": "Witch's Cauldron", "type": "artifact", "rarity": "rare", "description": "Boils perpetually without any fire beneath it.", "effect": "summon_spirit" },
        { "name": "Thorn-Braided Whip", "type": "weapon", "rarity": "uncommon", "description": "Each strike draws blood to feed the living metal.", "effect": "poison_damage" },
        { "name": "Tattered War-Banner", "type": "relic", "rarity": "rare", "description": "Inspires fear in the hearts of those beneath its shadow.", "effect": "curse_resistance" },
        { "name": "Iron Gauntlets of Might", "type": "armor", "rarity": "uncommon", "description": "Heavy hands that can crush stone.", "effect": "curse_resistance" },
        { "name": "Vial of Starlight", "type": "consumable", "rarity": "rare", "description": "A drop of pure essence from the firmament.", "effect": "mana_restore" },
        { "name": "Serrated Falchion", "type": "weapon", "rarity": "common", "description": "Cruel blade designed to leave jagged wounds.", "effect": "poison_damage" },
        { "name": "Wolf-Skin Bracers", "type": "armor", "rarity": "common", "description": "Keeps the hands warm and steady in the forest.", "effect": "curse_resistance" },
        { "name": "Obsidian Key", "type": "relic", "rarity": "rare", "description": "Opens a door that exists only in dreams.", "effect": "shadow_damage" },
        { "name": "Cursed Gold Coin", "type": "artifact", "rarity": "uncommon", "description": "Every spending brings a small, personal tragedy.", "effect": "shadow_damage" },
        { "name": "Monk's Prayer Beads", "type": "relic", "rarity": "common", "description": "Smoothed by decades of repetitious chant.", "effect": "mana_restore" },
        { "name": "Dragonslayer's Greatsword", "type": "weapon", "rarity": "legendary", "description": "A massive blade with the power to sever fire.", "effect": "fire_damage" },
        { "name": "Chimera-Leather Vest", "type": "armor", "rarity": "rare", "description": "Resistant to fire, frost, and physical blows.", "effect": "curse_resistance" },
        { "name": "Powdered Gargoyle Stone", "type": "consumable", "rarity": "uncommon", "description": "Ingested to briefly harden the soft organs.", "effect": "curse_resistance" },
        { "name": "Crystal Inkwell", "type": "relic", "rarity": "rare", "description": "The ink never dries, representing eternal time.", "effect": "mana_restore" },
        { "name": "Shadow-Bound Staff", "type": "weapon", "rarity": "rare", "description": "The wood is harvested from the hanging trees.", "effect": "summon_spirit" },
        { "name": "Talisman of Protection", "type": "relic", "rarity": "common", "description": "A simple piece of bone with protective carvings.", "effect": "curse_resistance" },
        { "name": "Blood-Red Elixir", "type": "consumable", "rarity": "elite", "description": "Grants immense power at the cost of your future years.", "effect": "heal_hp" }
    ],
    "npcs": [
        { "name": "Vance of the Ash", "role": "grave_keeper", "region": "ruins", "personality": "stoic", "description": "A tall man with burnt hands who knows every soul buried in the valley." },
        { "name": "Mother Myra", "role": "witch", "region": "swamp", "personality": "sinister", "description": "She brews stews from things better left unmentioned." },
        { "name": "Silas the Blind", "role": "hermit", "region": "mountain", "personality": "wise", "description": "He claims to see the path of the stars clearer than anyone with eyes." },
        { "name": "The Weeping Knight", "role": "wandering_knight", "region": "forest", "personality": "melancholic", "description": "His armor is streaked with rust and tears, his sword never leaves its scabbard." },
        { "name": "Brom the Heavy", "role": "blacksmith", "region": "ruins", "personality": "gruff", "description": "He hammers iron to drow out the voices in his head." },
        { "name": "Kaelen Grey", "role": "merchant", "region": "desert", "personality": "opportunistic", "description": "He sells water and hope, both at a very high price." },
        { "name": "Sovereign Malphas", "role": "cult_priest", "region": "abyss", "personality": "fanatical", "description": "Leading his followers into the dark with a smile of divine madness." },
        { "name": "Lyra Shadow-Step", "role": "assassin", "region": "cursed_land", "personality": "cold", "description": "A professional killer who believes death is the only true peace." },
        { "name": "Commander Thorne", "role": "soldier", "region": "ruins", "personality": "disciplined", "description": "Trying to hold a line that was broken long before he was born." },
        { "name": "Elder Oryn", "role": "hermit", "region": "tundra", "personality": "patient", "description": "He has sat in the same cave for forty years, waiting for the snow to stop." },
        { "name": "Bellamy the Bard", "role": "merchant", "region": "forest", "personality": "cynical", "description": "Sells poems about the end of the world." },
        { "name": "Ser Galahad the Broken", "role": "wandering_knight", "region": "cursed_land", "personality": "honorable", "description": "Searching for a grail that he knows has been stolen." },
        { "name": "Witch-Hunter Vane", "role": "assassin", "region": "swamp", "personality": "ruthless", "description": "Carries more silver stakes than words." },
        { "name": "The Alchemist", "role": "merchant", "region": "volcanic", "personality": "eccentric", "description": "Always covered in soot and smelling of brimstone." },
        { "name": "Old Mara", "role": "witch", "region": "forest", "personality": "secretive", "description": "Knows the language of the birds but refuses to translate." },
        { "name": "Captain Graves", "role": "grave_keeper", "region": "cursed_land", "personality": "jaded", "description": "Fights the things that won't stay in their graves." },
        { "name": "Brother Thomas", "role": "cult_priest", "region": "monastery", "personality": "gentle", "description": "Offers solace in the form of quiet prayers and hot soup." },
        { "name": "Jana of the Dunes", "role": "soldier", "region": "desert", "personality": "fierce", "description": "Her eyes are as sharp as the scimitar at her hip." },
        { "name": "The Iron Merchant", "role": "merchant", "region": "mountain", "personality": "monotone", "description": "Sells scrap metal recovered from the high slopes." },
        { "name": "Lucien the Exile", "role": "blacksmith", "region": "ruins", "personality": "bitter", "description": "Once a master, now forging daggers for thieves." },
        { "name": "The Nameless Monk", "role": "hermit", "region": "ruins", "personality": "silent", "description": "Sweeps the halls of the temple every day for no obvious reason." },
        { "name": "Sister Valery", "role": "witch", "region": "cursed_land", "personality": "pious", "description": "Believes the corruption can be prayed away with enough blood." },
        { "name": "Arren the Scout", "role": "soldier", "region": "forest", "personality": "observant", "description": "Knows which trees the shadows like to live in." },
        { "name": "Morigan the Raven", "role": "witch", "region": "tundra", "personality": "mysterious", "description": "Surrounded by birds that seem to whisper in her ear." },
        { "name": "The Blind Oracle", "role": "hermit", "region": "abyss", "personality": "distant", "description": "Describes the surface world as if it were a fairytale." },
        { "name": "Garret of the Forge", "role": "blacksmith", "region": "volcanic", "personality": "hearty", "description": "The only man who can stand the heat of the lower vents." },
        { "name": "Merchant Prince Elian", "role": "merchant", "region": "coast", "personality": "arrogant", "description": "Controls the salt trade with an iron fist." },
        { "name": "The Last Paladin", "role": "wandering_knight", "region": "ruins", "personality": "valiant", "description": "Guarding a relic that has long since lost its power." },
        { "name": "Grave-Robber Jax", "role": "merchant", "region": "ruins", "personality": "shifty", "description": "Will sell you back your own family crest for the right price." },
        { "name": "The Herbalist", "role": "witch", "region": "forest", "personality": "reclusive", "description": "Only comes out at night to gather glowing moss." },
        { "name": "Warden Selene", "role": "soldier", "region": "mountain", "personality": "stern", "description": "Watches the high passes for the arrival of the demons." },
        { "name": "Brother Kane", "role": "grave_keeper", "region": "swamp", "personality": "solemn", "description": "Marking the spots where the bog has taken another soul." },
        { "name": "The Shadow Merchant", "role": "merchant", "region": "cursed_land", "personality": "creepy", "description": "He doesn't have a face, only a cloak full of items." },
        { "name": "Sir Cedric the Coward", "role": "wandering_knight", "region": "desert", "personality": "fearful", "description": "Fleeing from a mistake he made twenty years ago." },
        { "name": "The Bone-Smith", "role": "blacksmith", "region": "abyss", "personality": "obsessive", "description": "Uses dragon bones to forge unbreakable shields." },
        { "name": "Mistress Vala", "role": "assassin", "region": "ruins", "personality": "elegant", "description": "Kills with a poison that smells of lavender." },
        { "name": "The Hermit King", "role": "hermit", "region": "mountain", "personality": "delusional", "description": "Thinks the goats are his royal subjects." },
        { "name": "Father Malachi", "role": "cult_priest", "region": "ruins", "personality": "paternal", "description": "Welcomes any traveler into his church for a 'special' blessing." },
        { "name": "Orin the Drunkard", "role": "merchant", "region": "coast", "personality": "unreliable", "description": "Knows the harbor better than anyone but can rarely speak." },
        { "name": "Tessa the Orphan", "role": "soldier", "region": "cursed_land", "personality": "brave", "description": "Fights for a home she can barely remember." },
        { "name": "The Scrivener", "role": "merchant", "region": "ruins", "personality": "precise", "description": "Copies old texts for a handful of copper coins." },
        { "name": "Old Gid", "role": "hermit", "region": "swamp", "personality": "mumbling", "description": "Talks to the frogs and listens to their answers." },
        { "name": "The Crimson Knight", "role": "wandering_knight", "region": "volcanic", "personality": "aggressive", "description": "Searches for a foe strong enough to end his life." },
        { "name": "The Necromancer's Apprentice", "role": "witch", "region": "ruins", "personality": "ambitious", "description": "Trying to master the art of life before his master kills him." },
        { "name": "Sister Rose", "role": "cult_priest", "region": "forest", "personality": "fanatical", "description": "Believes the trees are gods that demand blood." },
        { "name": "Bryn of the Highlands", "role": "soldier", "region": "mountain", "personality": "loyal", "description": "Will never abandon his post, even in death." },
        { "name": "The Junk Merchant", "role": "merchant", "region": "desert", "personality": "hopeful", "description": "Thinks he found a piece of a sun-god's shield." },
        { "name": "The Keeper of Keys", "role": "grave_keeper", "region": "ruins", "personality": "enigmatic", "description": "Holds the keys to every gate in the ancient city." },
        { "name": "Lady Isabelle", "role": "assassin", "region": "coast", "personality": "vengeful", "description": "Hunts the pirates who murdered her family." },
        { "name": "The Wanderer", "role": "hermit", "region": "any", "personality": "lost", "description": "A man with no memory, wandering aimlessly between the biomes." }
    ],
    "factions": [
        { "name": "The Iron Covenant", "type": "religious_order", "ideology": "absolute law", "description": "Fanatics who believe order must be imposed through steel and fire." },
        { "name": "The Crimson Cult", "type": "cult", "ideology": "blood ascension", "description": "Seek to awaken the sleeping gods with massive sacrifices." },
        { "name": "The Gilded League", "type": "merchant_league", "ideology": "wealth is power", "description": "Control the flow of gold and salt across the known world." },
        { "name": "Shadow Hand", "type": "secret_society", "ideology": "unseen control", "description": "A network of spies and killers who influence thrones from the dark." },
        { "name": "The Broken Crown", "type": "mercenary_guild", "ideology": "survival by any means", "description": "Disgraced knights and soldiers for hire." },
        { "name": "Order of the Silent Light", "type": "religious_order", "ideology": "purity through silence", "description": "Monks who take vows of silence to hear the whispers of the gods." },
        { "name": "The Necro-Council", "type": "secret_society", "ideology": "mastery of death", "description": "A group of mages seeking the secret to eternal life." },
        { "name": "The High Mountain Throne", "type": "kingdom", "ideology": "heredity and strength", "description": "The last remnants of an ancient dwarven empire." },
        { "name": "The Sea-Bane Syndicate", "type": "merchant_league", "ideology": "dominion of the waves", "description": "Control the shipping routes through piracy and extortion." },
        { "name": "The Void-Seekers", "type": "cult", "ideology": "return to nothingness", "description": "Believe the world is a mistake that must be unmade." },
        { "name": "The Hammer of Virtue", "type": "religious_order", "ideology": "destruction of evil", "description": "Hunters who roam the land looking for monsters to slay." },
        { "name": "The Silver Circle", "type": "secret_society", "ideology": "preservation of lore", "description": "Guardians of ancient texts and forgotten magic." },
        { "name": "The Desert Kings", "type": "kingdom", "ideology": "traditionalism and nomadism", "description": "Tribes of the shifting sands who acknowledge no central throne." },
        { "name": "The Black Marsh Covenant", "type": "mercenary_guild", "ideology": "strength in unity", "description": "Survivors of the swamp who sell their services to the highest bidder." },
        { "name": "The Sun-Scribes", "type": "religious_order", "ideology": "worship of the light", "description": "Trying to bring back the sun to a dying world." },
        { "name": "The Flesh-Architects", "type": "cult", "ideology": "perfection of form", "description": "Experiment on animals and humans to create superior beings." },
        { "name": "The Rune-Smiths", "type": "merchant_league", "ideology": "innovation and trade", "description": "The only producers of magic-infused steel." },
        { "name": "The Last Bastion", "type": "kingdom", "ideology": "fortification and defense", "description": "A city built into a mountain, resisting the dark every day." },
        { "name": "The Serpent's Coil", "type": "secret_society", "ideology": "cunning and patience", "description": "A group that uses manipulation and debt to control entire towns." },
        { "name": "The Graveyard Watch", "type": "mercenary_guild", "ideology": "duty and honor", "description": "Protectors of the dead who will guard any tomb for a price." }
    ],
    "regions": [
        { "name": "Ash Valley", "biome": "volcanic", "danger_level": 9, "description": "A valley perpetually choked with soot and rivers of cooling lava." },
        { "name": "Frozen Tundra", "biome": "tundra", "danger_level": 6, "description": "A vast, white wasteland where the wind cuts like a razor." },
        { "name": "Shadow Forest", "biome": "forest", "danger_level": 4, "description": "Ancient trees whose branches weave together to block out the sun." },
        { "name": "Moonlit Marsh", "biome": "swamp", "danger_level": 5, "description": "A glowing, bioluminescent bog filled with deceptive lights." },
        { "name": "Crimson Coast", "biome": "coast", "danger_level": 3, "description": "The sands here are stained red by the iron in the jagged rocks." },
        { "name": "Golden Desert", "biome": "desert", "danger_level": 7, "description": "Massive dunes that hide the ruins of a thousand-year-old empire." },
        { "name": "Void Abyss", "biome": "abyss", "danger_level": 10, "description": "A lightless canyon that descends into the heart of the world." },
        { "name": "Crystal Caverns", "biome": "mountain", "danger_level": 8, "description": "Beautiful, sharp crystals that hum with a lethal frequency." },
        { "name": "Iron Peaks", "biome": "mountain", "danger_level": 9, "description": "Jagged mountains where the air is thin and the monsters are heavy." },
        { "name": "Dead City of Aethel", "biome": "ruins", "danger_level": 8, "description": "A sprawling metropolis where nobody has lived for a century." },
        { "name": "The Screaming Cliffs", "biome": "coast", "danger_level": 6, "description": "The wind through the holes in the rocks sounds like human agony." },
        { "name": "Infernal Rift", "biome": "volcanic", "danger_level": 9, "description": "A tear in the earth that leads to the magma chambers below." },
        { "name": "Whispering Woods", "biome": "forest", "danger_level": 2, "description": "The trees aren't dangerous, but the voices they carry are." },
        { "name": "The Poisoned Mire", "biome": "swamp", "danger_level": 7, "description": "The water is toxic and the air is thicker than soup." },
        { "name": "Sunken Temple of Sol", "biome": "ruins", "danger_level": 8, "description": "A religious site partially swallowed by the shifting sands." },
        { "name": "Glacial Pass", "biome": "tundra", "danger_level": 5, "description": "The only way through the North, but it’s often blocked by ice." },
        { "name": "The Obsidian Spire", "biome": "mountain", "danger_level": 10, "description": "A single tower made of black glass that reaches the clouds." },
        { "name": "Cursed Meadows", "biome": "cursed_land", "danger_level": 4, "description": "Beautiful flowers that bloom from the blood of fallen soldiers." },
        { "name": "The Bleached Dunes", "biome": "desert", "danger_level": 6, "description": "Sands made entirely of crushed bone." },
        { "name": "Serpent's Delta", "biome": "swamp", "danger_level": 5, "description": "A network of waterways where the predators are always wet." },
        { "name": "The Hanging Gardens", "biome": "ruins", "danger_level": 6, "description": "Once a paradise, now a tangle of thorns and skeletons." },
        { "name": "Volcanic Citadel", "biome": "volcanic", "danger_level": 8, "description": "A fortress built on the rim of an active volcano." },
        { "name": "Sky-Reach Monastery", "biome": "mountain", "danger_level": 3, "description": "The highest point on the continent, where the air is pure." },
        { "name": "The Void Gates", "biome": "abyss", "danger_level": 10, "description": "A pair of massive statues guarding nothingness." },
        { "name": "Rusted Harbour", "biome": "coast", "danger_level": 4, "description": "Ships don't sail from here anymore; they just rot." },
        { "name": "Silent Steppe", "biome": "tundra", "danger_level": 3, "description": "A flat wasteland where sound carries for miles." },
        { "name": "Dark-Well Catacombs", "biome": "ruins", "danger_level": 7, "description": "Burying the dead beneath the dead beneath the dead." },
        { "name": "The Burning Steppe", "biome": "volcanic", "danger_level": 8, "description": "Grass that is perpetually on fire without being consumed." },
        { "name": "Forgotten Oasis", "biome": "desert", "danger_level": 5, "description": "A paradise found only by those who are truly lost." },
        { "name": "The Endless Maw", "biome": "abyss", "danger_level": 10, "description": "A pit that seems to grow larger every time you look at it." }
    ]
};

async function seed() {
    console.log('🚀 Starting Data Seeding...');

    try {
        // 1. Monsters
        console.log('--- Seeding Monsters ---');
        for (const m of DATA.monsters) {
            // Generate stats based on rarity
            let min = 5, max = 15;
            if (m.rarity === 'uncommon') { min = 15; max = 30; }
            if (m.rarity === 'rare') { min = 30; max = 50; }
            if (m.rarity === 'elite') { min = 50; max = 80; }
            if (m.rarity === 'legendary') { min = 80; max = 150; }

            const stats = {
                name: m.name,
                type: m.type,
                biome: m.biome,
                rarity: m.rarity,
                description: m.description,
                level: m.rarity === 'legendary' ? 50 : m.rarity === 'elite' ? 30 : Math.floor(Math.random() * 20) + 1,
                base_hp: Math.floor(Math.random() * (max - min) + min) * 10,
                base_attack: Math.floor(Math.random() * (max - min) + min),
                base_defense: Math.floor(Math.floor(Math.random() * (max - min) + min) / 2),
                speed: Math.floor(Math.random() * 15) + 5,
                skill_id: 111111111 + Math.floor(Math.random() * 888888888)
            };
            await createMonster(stats);
            process.stdout.write('.');
        }
        console.log('\nMonsters seeded.');

        // 2. Items & Equipment
        console.log('--- Seeding Items & Equipment ---');
        for (const i of DATA.items) {
            if (i.type === 'weapon' || i.type === 'armor') {
                const slot = i.type === 'weapon' ? 'weapon' : 'armor';
                await createEquipment({
                    name: i.name,
                    slot: slot,
                    rarity: i.rarity,
                    description: i.description,
                    attack_bonus: i.effect === 'fire_damage' || i.effect === 'shadow_damage' ? 15 : 5,
                    defense_bonus: i.effect === 'curse_resistance' ? 10 : 0
                });
            } else {
                await createItem({
                    name: i.name,
                    type: i.type,
                    rarity: i.rarity,
                    description: i.description,
                    stat_bonus: { effect: i.effect }
                });
            }
            process.stdout.write('.');
        }
        console.log('\nItems/Equipment seeded.');

        // 3. NPCs
        console.log('--- Seeding NPCs ---');
        for (const n of DATA.npcs) {
            await createNPC(n);
            process.stdout.write('.');
        }
        console.log('\nNPCs seeded.');

        // 4. Factions
        console.log('--- Seeding Factions ---');
        for (const f of DATA.factions) {
            await createFaction(f);
            process.stdout.write('.');
        }
        console.log('\nFactions seeded.');

        // 5. Regions (Maps)
        console.log('--- Seeding Regions (Maps) ---');
        for (const r of DATA.regions) {
            await createMap({
                name: r.name,
                biome: r.biome,
                danger_level: r.danger_level,
                description: r.description
            });
            process.stdout.write('.');
        }
        console.log('\nRegions seeded.');

        console.log('\n✅ Database Seeding Complete!');
    } catch (err) {
        console.error('\n❌ Seeding Failed:', err);
    }
}

seed();
