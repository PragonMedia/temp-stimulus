// Generate flag stars in the canton (blue field)
const starsContainer = document.getElementById("stars");

// Create 50 stars in a 9-row pattern (alternating 6 and 5 stars)
const rows = 9;
const starsInRow = [6, 5, 6, 5, 6, 5, 6, 5, 6];
const starSize = 16;

for (let row = 0; row < rows; row++) {
  const numStars = starsInRow[row];
  const isOffsetRow = numStars === 5;

  for (let col = 0; col < numStars; col++) {
    const star = document.createElement("div");
    star.className = "star";
    star.style.width = starSize + "px";
    star.style.height = starSize + "px";

    // Calculate position as percentage within the canton
    const horizontalSpacing = 40 / (6 + 1); // 40% is canton width
    const verticalSpacing = 53.85 / (rows + 1); // 53.85% is canton height

    if (isOffsetRow) {
      star.style.left =
        (col + 1) * horizontalSpacing + horizontalSpacing / 2 + "%";
    } else {
      star.style.left = (col + 1) * horizontalSpacing + "%";
    }

    star.style.top = (row + 1) * verticalSpacing + "%";
    star.style.animationDelay = row * 0.1 + col * 0.05 + "s";
    star.style.animation = "twinkle 2.5s ease-in-out infinite";

    starsContainer.appendChild(star);
  }
}
