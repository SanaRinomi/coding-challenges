import Heapify from "https://unpkg.com/heapify";

class Cell {
    constructor(grid, x, y, value = " ") {
        this.type = "cell";
        this.grid = grid;
        this.id = grid.toID(x, y);
        this.x = x;
        this.y = y;
        this.value = value;
        this.oneWay = false;
        this.connected = new Map();
    }

    toString() {
        return `[Type: ${this.type}] ${this.id} (${this.x}, ${this.y})`;
    }
}

class Node extends Cell {
    constructor(grid, x, y, value = " ") {
        super(grid, x, y, value);
        this.type = "node";

        this.paths = [];
    }

    connect(node = null, map = new Set(), steps = 0) {
        if(!node) node = this;
        map.add(node.id);

        
        if(steps === 0) {
            ++steps;
            this.grid.getAdjacent(this.x, this.y).forEach((v) => {
                if(map.has(v.id)) return;
                this.connect(v, map, steps);
            });
            return;
        } else{
            if(!node.connected.get(this.id) || node.connected.get(this.id).steps > steps);
                node.connected.set(this.id, steps);

            if(node.type === "node") {
                node.paths.push({node: this, steps});
                //console.log(`Node ${this.toString()} is ${steps} away from ${node.toString()}`);
            } else {
                ++steps;
                this.grid.getAdjacent(node.x, node.y).forEach((v) => {
                    if(map.has(v.id)) return;
                    this.connect(v, new Set(map), steps);
                });
            }
        }
    }

    hasCell(id) {
        return this.paths.find((v) => {return v.map.has(id);}) ? true : false;
    }

    static toNode(cell) {
        let node = new Node(cell.grid, cell.x, cell.y, cell.value);
        node.oneWay = cell.oneWay;
        node.grid.cells.set(node.id, node);
        return node;
    }
}

class Grid {
    constructor(width = null, height = 0) {
        this.width = width;
        this.height = height;
        this.cells = new Map();
        this.nodes = new Map();
    }

    loadRow(str, h) {
        const val = str.split("");
        ++this.height;
        this.width = this.width ? this.width : val.length;

        val.forEach((v, i) => {
            if(v !== "#") {
                let cell = new Cell(this, i, h, v);
                this.cells.set(cell.id, cell);
            }
        });
    }

    getAdjacent(x, y) {
        // console.log(`Getting Adjacent for: ${this.toID(x, y)} (${x}, ${y})`);
        let arr = [];

        const left = x ? this.toID(x-1, y) : this.toID(this.width-1, y);
        if(this.cells.has(left)) arr.push(this.cells.get(left));

        const right = x < this.width-1 ? this.toID(x+1, y) : this.toID(0, y);
        if(this.cells.has(right)) arr.push(this.cells.get(right));

        const top = y ? this.toID(x, y-1) : -1;
        if(this.cells.has(top)) arr.push(this.cells.get(top));

        const bottom = y < this.height ? this.toID(x, y+1) : -1;
        if(this.cells.has(bottom)) arr.push(this.cells.get(bottom));

        // console.log(`Possible adjacents: ${top}, ${right}, ${bottom} and ${left} (W: ${this.width}, H: ${this.height})`);

        return arr;
    }

    establish() {
        this.cells.forEach(v => {
            let adj = this.getAdjacent(v.x, v.y);
            if(adj.length !== 2)
                if(adj.length === 1) v.oneWay = true;
                this.nodes.set(v.id, Node.toNode(v));
        });

        this.nodes.forEach(v => {
            v.connect();
        });
    }

    toID(x, y) {
        return x+(y*this.width);
    }

    toCoords(id) {
        return {x: id%this.width, y: Math.floor(id/this.width)};
    }

    connectedNodes(x, y) {
        const location = this.toID(x, y);
        let mp = new Map();
        this.nodes.forEach(v => {
            if(v.hasCell(location))
                mp.set(v.id, v);
        });

        return mp;
    }

    dijkstra(pos1, pos2 = null) {
        let pseudo1 = this.cells.get(pos1),
            pseudo2 = pos2 ? this.cells.get(pos2) : null;

        let distance = new Map(),
            visited = new Set();
        distance.set(pos1, 0);

        let nodes = new Map(this.nodes);
        let paths = new Map();

        let PQ = new Heapify();
        PQ.push(pos1, 0);

        if(pseudo1.type !== "node")
            nodes.set(pos1, pseudo1);
        if(pseudo2 && pseudo2.type !== "node")
            nodes.set(pos2, pseudo2);

        while(PQ.length > 0) {
            let dist = PQ.peekPriority()
            let node = PQ.pop();
            visited.add(node);

            let currNode = nodes.get(node);

            if(distance.get(node) && distance.get(node) < dist) return;
            currNode.connected.forEach((v, i) => {
                if(visited.has(i)) return;

                let distCost = distance.get(node) + v;
                
                if(!distance.get(i) || distCost < distance.get(i)) {
                    distance.set(i, distCost);
                    paths.set(i, node)
                    PQ.push(i, distCost);
                }
            })
        }

        return {distance, paths};
    }

    shortestPath(x1, y1, x2, y2) {
        const pos1 = this.toID(x1, y1),
            pos2 = this.toID(x2, y2);
        let {distance, paths} = this.dijkstra(pos1, pos2);

        let path = [];

        if(distance.get(pos2) === undefined) return path;

        for(let at = pos2; at !== undefined; at = paths.get(at))
            path.push(at);
        path.reverse();

        return path;
    }
}

class Player {
    get isTargetReached() {
        return this.target.x === this.x && this.target.y === this.y;
    }

    constructor(grid, pacId, x, y, visited = null) {
        this.grid = grid;
        this.pacId = pacId;
        this.x = x;
        this.y = y;
        this.currentCell = this.grid.cells.get(this.grid.toID(x, y));
        this.target = {x: x, y: y};
        this.visited = visited ? visited : new Map();

        this.updateTarget();
    }

    updateTarget(stuck = false) {
        let candidate = {id: -1, value: 0, distance: 0};

        this.currentCell.connected.forEach((v, i) => {
            let visit = this.visited.get(i);

            if(visit) {
                if(candidate.id === -1 || visit < candidate.value)
                    candidate = {id: i, value: visit, distance: v}
            } else if(candidate.id === -1 || 0 < candidate.value || v > candidate.distance)
                candidate = {id: i, value: 0, distance: v}
        });

        this.visited.set(candidate.id, this.grid.cells.get(candidate.id).oneWay ? 999 : candidate.value+1);

        this.target = this.grid.toCoords(candidate.id);
        return this.target;
    }

    updateCoords(x, y) {
        if(this.x === x && this.y === y) {
            this.updateTarget(x, y, true);
            return;
        }

        this.currentCell = this.grid.cells.get(this.grid.toID(x, y));
        this.currentCell.value = 0;

        this.x = x;
        this.y = y;

        if(this.isTargetReached)
            this.updateTarget(x, y);
    }

    move() {
        return `MOVE ${this.pacId} ${this.target.x} ${this.target.y}`;
    }
}

var inputs = readline().split(' ');
const width = parseInt(inputs[0]); // size of the grid
const height = parseInt(inputs[1]); // top left corner is (x=0, y=0)
const grid = new Grid();
for (let i = 0; i < height; i++) {
    grid.loadRow(readline(), i); // one line of the grid: space " " is floor, pound "#" is wall
}

grid.establish();

let current = null;
let visited = new Map();
let pacs = new Map();

// game loop
while (true) {
    var inputs = readline().split(' ');
    const myScore = parseInt(inputs[0]);
    const opponentScore = parseInt(inputs[1]);
    const visiblePacCount = parseInt(readline()); // all your pacs and enemy pacs in sight

    for (let i = 0; i < visiblePacCount; i++) {
        var inputs = readline().split(' ');
        const pacId = parseInt(inputs[0]); // pac number (unique within a team)
        const mine = inputs[1] !== '0'; // true if this pac is yours
        if(mine) {
            let pac;
            if(pacs.has(pacId)) {
                pac = pacs.get(pacId);
                pac.updateCoords(parseInt(inputs[2]), parseInt(inputs[3]));
            } else {
                pac = new Player(grid, pacId, parseInt(inputs[2]), parseInt(inputs[3]), visited);
                pacs.set(pacId, pac);
            }
            pac.move();
        }
        const typeId = inputs[4]; // unused in wood leagues
        const speedTurnsLeft = parseInt(inputs[5]); // unused in wood leagues
        const abilityCooldown = parseInt(inputs[6]); // unused in wood leagues
    }
    const visiblePelletCount = parseInt(readline()); // all pellets in sight
    for (let i = 0; i < visiblePelletCount; i++) {
        var inputs = readline().split(' ');
        const x = parseInt(inputs[0]);
        const y = parseInt(inputs[1]);
        const value = parseInt(inputs[2]); // amount of points this pellet is worth
    }

    let comm = [];
    pacs.forEach(p => {
        comm.push(p.move());
    });

    console.log(comm.join(" | "));
}