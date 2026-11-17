#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <limits.h>




bool isValidBST(struct TreeNode* root)
{
    int top = 0;
    int prev = INT_MIN;
    bool first = true;
    struct TreeNode *stack[1000];
    while (top > 0 || root != NULL) {
        if (root != NULL) {
            stack[top++] = root;
            root = root->left;
        } else {
            root = stack[--top];
            if (!first && prev >= root->val) {
                return false;
            }
            first = false;
            prev = root->val;
            root = root->right;
        }
    }
    return true;
}
