use wasm_bindgen::prelude::*;
use std::collections::{BinaryHeap, HashMap};
use serde_wasm_bindgen::to_value;

#[wasm_bindgen]
pub struct Pathfinding {
    width: usize,
    height: usize,
    grid: Vec<Vec<u8>>, // 0 = walkable, 1 = obstacle
}

#[wasm_bindgen]
impl Pathfinding {
    #[wasm_bindgen(constructor)]
    pub fn new(width: usize, height: usize) -> Pathfinding {
        Pathfinding {
            width,
            height,
            grid: vec![vec![0; height]; width],
        }
    }

    pub fn set_obstacle(&mut self, x: usize, y: usize) {
        if x < self.width && y < self.height {
            self.grid[x][y] = 1;
        }
    }

    pub fn clear_obstacle(&mut self, x: usize, y: usize) {
        if x < self.width && y < self.height {
            self.grid[x][y] = 0;
        }
    }

    #[wasm_bindgen]
    pub fn find_path(&self, start_x: usize, start_y: usize, end_x: usize, end_y: usize) -> Vec<JsValue> {
        let path = astar((start_x, start_y), (end_x, end_y), &self.grid);
        web_sys::console::log_1(&format!("Path found: {:?}", path).into());
        path.into_iter().map(|(x, y)| to_value(&(x, y)).unwrap()).collect()
    }
}

// A* Algorithm Implementation
fn astar(start: (usize, usize), goal: (usize, usize), grid: &Vec<Vec<u8>>) -> Vec<(usize, usize)> {
    let mut open_set = BinaryHeap::new();
    let mut came_from: HashMap<(usize, usize), (usize, usize)> = HashMap::new();
    let mut g_score = HashMap::new();
    let mut f_score = HashMap::new();

    g_score.insert(start, 0);
    f_score.insert(start, heuristic(start, goal));
    open_set.push((std::cmp::Reverse(heuristic(start, goal)), start));

    while let Some((_, current)) = open_set.pop() {
        if current == goal {
            return reconstruct_path(came_from, current);
        }

        for (neighbor, cost) in neighbors(current, grid) {
    let tentative_g_score = g_score.get(&current).unwrap_or(&usize::MAX) + cost;

    if tentative_g_score < *g_score.get(&neighbor).unwrap_or(&usize::MAX) {
        came_from.insert(neighbor, current);
        g_score.insert(neighbor, tentative_g_score);
        f_score.insert(neighbor, tentative_g_score + heuristic(neighbor, goal));
        open_set.push((std::cmp::Reverse(f_score[&neighbor]), neighbor));
    }
}
    }
    vec![] // No path found
}

fn heuristic(a: (usize, usize), b: (usize, usize)) -> usize {
    let dx = (a.0 as isize - b.0 as isize).abs() as usize;
    let dy = (a.1 as isize - b.1 as isize).abs() as usize;
    dx + dy
}

fn neighbors(pos: (usize, usize), grid: &Vec<Vec<u8>>) -> Vec<((usize, usize), usize)> {
    let mut results = Vec::new();
    let (x, y) = pos;

    let directions = [
        ((0, 1), 1), ((1, 0), 1), ((0, -1), 1), ((-1, 0), 1),   // Cardinal (cost 1)
        ((1, 1), 2), ((1, -1), 2), ((-1, 1), 2), ((-1, -1), 2)  // Diagonal (cost √2 ≈ 1.41 → rounded to 2)
    ];

    for &((dx, dy), cost) in &directions {
        let nx = x as isize + dx;
        let ny = y as isize + dy;

        if nx >= 0 && ny >= 0 &&
           (nx as usize) < grid.len() &&
           (ny as usize) < grid[0].len()
        {
            if grid[nx as usize][ny as usize] == 0 {
                results.push(((nx as usize, ny as usize), cost));
            }
        }
    }
    results
}

fn reconstruct_path(came_from: HashMap<(usize, usize), (usize, usize)>, mut current: (usize, usize)) -> Vec<(usize, usize)> {
    let mut path = vec![current];
    while let Some(&prev) = came_from.get(&current) {
        current = prev;
        path.push(current);
    }
    path.reverse();
    path
}
